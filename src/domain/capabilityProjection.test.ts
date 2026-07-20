import { describe, expect, it } from "vitest";
import { seedEvents } from "../data/sample";
import { capabilityDecisionPayloadSchema, capabilityEvaluationPayloadSchema } from "./capability";
import type { EvidenceEvent } from "./types";
import { reduceWorkspace } from "./workspaceProjection";

function gateEvidenceEventIds(capability: ReturnType<typeof reduceWorkspace>["capabilities"][number]) {
  return [
    ...new Set(
      capability.gate.requirements
        .filter((requirement) => requirement.id !== "human_approval")
        .flatMap((requirement) => requirement.evidenceEventIds)
    )
  ];
}

function decisionEvent(decision: "approved" | "rejected", revisionRequest?: string): EvidenceEvent {
  const capability = reduceWorkspace(seedEvents).capabilities.find(
    (candidate) => candidate.manifest.id === "value-density-reviewer"
  );
  if (!capability) throw new Error("Prepared capability missing");
  return {
    id: `evt-capability-${decision}-test`,
    type: "capability.activation_decided",
    kind: "user_interpretation",
    createdAt: "2026-07-20T08:00:00.000Z",
    actor: "human",
    summary: `${decision} the prepared capability.`,
    sourceIds: capability.manifest.sourceIds,
    payload: {
      capabilityId: capability.manifest.id,
      decision,
      reason: "The declared evidence was reviewed by a human.",
      gateEvidenceEventIds: gateEvidenceEventIds(capability),
      ...(decision === "rejected" ? { revisionRequest: revisionRequest ?? "Revise and resubmit." } : {})
    }
  };
}

function withFailedEvaluationBeforePreparedRun() {
  const passingIndex = seedEvents.findIndex(
    (event) =>
      event.type === "capability.evaluation_recorded" && event.payload.capabilityId === "value-density-reviewer"
  );
  const passingEvent = seedEvents[passingIndex];
  if (!passingEvent) throw new Error("Prepared evaluation event missing");
  const { capabilityId, evaluation } = capabilityEvaluationPayloadSchema.parse(passingEvent.payload);
  const failedCases = evaluation.cases.map((result, index) =>
    index === 0 ? { ...result, status: "failed" as const, evidence: "The audience was not identified." } : result
  );
  const failedEvent: EvidenceEvent = {
    ...passingEvent,
    id: "evt-capability-evaluation-failed-earlier",
    createdAt: "2026-07-14T09:59:00.000Z",
    summary: "Recorded an earlier failed capability evaluation.",
    payload: {
      capabilityId,
      evaluation: { passed: evaluation.total - 1, total: evaluation.total, cases: failedCases }
    }
  };
  return [...seedEvents.slice(0, passingIndex), failedEvent, ...seedEvents.slice(passingIndex)];
}

describe("capability projection", () => {
  it("projects evaluation, approval, and activation as separate legal states", () => {
    const evaluated = reduceWorkspace(seedEvents).capabilities[0];
    expect(evaluated.manifest.status).toBe("evaluated");
    expect(evaluated.gate).toMatchObject({ approvalReady: true, activationReady: false });

    const approval = decisionEvent("approved");
    const approved = reduceWorkspace([...seedEvents, approval]).capabilities[0];
    expect(approved.manifest.status).toBe("approved");
    expect(approved.gate.activationReady).toBe(true);

    const activation: EvidenceEvent = {
      id: "evt-capability-activation-test",
      type: "capability.activated",
      kind: "user_interpretation",
      createdAt: "2026-07-20T08:01:00.000Z",
      actor: "human",
      summary: "Activated the prepared capability after approval.",
      sourceIds: approved.manifest.sourceIds,
      payload: {
        capabilityId: approved.manifest.id,
        approvalEventId: approval.id,
        reason: "Use this approved version for the prepared project."
      }
    };
    const active = reduceWorkspace([...seedEvents, approval, activation]).capabilities[0];
    expect(active.manifest.status).toBe("active");
    expect(active.activation?.payload.approvalEventId).toBe(approval.id);
  });

  it("projects rejection with an actionable revision request", () => {
    const rejected = reduceWorkspace([
      ...seedEvents,
      decisionEvent("rejected", "Add a novice-user evaluation and clarify the accessibility boundary.")
    ]).capabilities[0];

    expect(rejected.manifest.status).toBe("rejected");
    expect(rejected.decision?.payload).toMatchObject({
      decision: "rejected",
      revisionRequest: "Add a novice-user evaluation and clarify the accessibility boundary."
    });
  });

  it("rejects duplicated gate evidence IDs that omit required evidence", () => {
    const approval = decisionEvent("approved");
    const payload = capabilityDecisionPayloadSchema.parse(approval.payload);
    expect(payload.gateEvidenceEventIds.length).toBeGreaterThan(2);
    const duplicatedEvidenceApproval: EvidenceEvent = {
      ...approval,
      id: "evt-capability-approval-duplicated-evidence",
      payload: {
        ...payload,
        gateEvidenceEventIds: [
          payload.gateEvidenceEventIds[0],
          payload.gateEvidenceEventIds[0],
          ...payload.gateEvidenceEventIds.slice(2)
        ]
      }
    };

    expect(() => reduceWorkspace([...seedEvents, duplicatedEvidenceApproval])).toThrow(
      "Evidence event IDs must be unique"
    );
  });

  it("retains prior failed evaluations while the latest run informs the gate", () => {
    const workspace = reduceWorkspace(withFailedEvaluationBeforePreparedRun());
    const capability = workspace.capabilities.find((candidate) => candidate.manifest.id === "value-density-reviewer");
    if (!capability) throw new Error("Prepared capability missing");

    expect(capability.evaluationHistory).toHaveLength(2);
    expect(capability.evaluationHistory[0].result.cases[0]).toMatchObject({
      status: "failed",
      evidence: "The audience was not identified."
    });
    expect(capability.evaluation?.evidenceEventId).toBe(capability.evaluationHistory[1].evidenceEventId);
    expect(
      capability.gate.requirements.find((requirement) => requirement.id === "evaluation")?.evidenceEventIds
    ).toEqual(capability.evaluationHistory.map((record) => record.evidenceEventId));
    expect(capability.gate.approvalReady).toBe(true);
  });

  it("supports a lighter low-risk understanding policy without bypassing approval", () => {
    const draft = reduceWorkspace(seedEvents).capabilities.find(
      (candidate) => candidate.manifest.id === "design-knowledge"
    );
    if (!draft) throw new Error("Low-risk capability missing");
    const declaredCase = draft.manifest.evaluationCases[0];
    const evaluation: EvidenceEvent = {
      id: "evt-capability-evaluation-low-risk",
      type: "capability.evaluation_recorded",
      kind: "validated_behavior",
      createdAt: "2026-07-20T08:00:00.000Z",
      actor: "system",
      summary: "Evaluated the low-risk knowledge module.",
      sourceIds: draft.manifest.sourceIds,
      payload: {
        capabilityId: draft.manifest.id,
        evaluation: {
          passed: 1,
          total: 1,
          cases: [
            {
              caseId: declaredCase.id,
              status: "passed",
              evidence: "Every prepared claim retained its source reference.",
              sourceIds: declaredCase.sourceIds
            }
          ]
        }
      }
    };
    const evaluated = reduceWorkspace([...seedEvents, evaluation]).capabilities.find(
      (candidate) => candidate.manifest.id === draft.manifest.id
    );
    expect(evaluated?.gate).toMatchObject({ approvalReady: true, activationReady: false });
    expect(evaluated?.gate.requirements.find((requirement) => requirement.id === "understanding")?.met).toBe(true);
    expect(evaluated?.gate.requirements.find((requirement) => requirement.id === "human_approval")?.met).toBe(false);
  });

  it("rejects activation without approval and evaluation results outside the declared case manifest", () => {
    const capability = reduceWorkspace(seedEvents).capabilities[0];
    const activation: EvidenceEvent = {
      id: "evt-capability-activation-invalid",
      type: "capability.activated",
      kind: "user_interpretation",
      createdAt: "2026-07-20T08:00:00.000Z",
      actor: "human",
      summary: "Invalid activation.",
      sourceIds: capability.manifest.sourceIds,
      payload: { capabilityId: capability.manifest.id, approvalEventId: "missing", reason: "Activate anyway." }
    };
    expect(() => reduceWorkspace([...seedEvents, activation])).toThrow("cannot activate without approval");

    const draft = reduceWorkspace(seedEvents).capabilities.find(
      (candidate) => candidate.manifest.id === "density-linter"
    );
    if (!draft) throw new Error("Draft capability missing");
    const invalidEvaluation: EvidenceEvent = {
      id: "evt-capability-evaluation-invalid-case",
      type: "capability.evaluation_recorded",
      kind: "validated_behavior",
      createdAt: "2026-07-20T08:00:00.000Z",
      actor: "system",
      summary: "Invalid evaluation case.",
      sourceIds: draft.manifest.sourceIds,
      payload: {
        capabilityId: draft.manifest.id,
        evaluation: {
          passed: 1,
          total: 1,
          cases: [
            {
              caseId: "undeclared-case",
              status: "passed",
              evidence: "This case was not declared.",
              sourceIds: draft.manifest.sourceIds
            }
          ]
        }
      }
    };
    expect(() => reduceWorkspace([...seedEvents, invalidEvaluation])).toThrow(
      "does not match its declared case manifest"
    );
  });

  it("requires a replacement to declare the capability it supersedes", () => {
    const original = reduceWorkspace(seedEvents).capabilities[0];
    const replacementRegistration: EvidenceEvent = {
      id: "evt-capability-replacement-registered",
      type: "capability.registered",
      kind: "agent_synthesis",
      createdAt: "2026-07-20T08:00:00.000Z",
      actor: "agent",
      summary: "Registered a traceable capability revision.",
      sourceIds: original.manifest.sourceIds,
      payload: {
        manifest: {
          ...original.manifest,
          id: "value-density-reviewer-0.2.0",
          version: "0.2.0",
          status: "draft",
          supersedesCapabilityId: original.manifest.id
        }
      }
    };
    const supersession: EvidenceEvent = {
      id: "evt-capability-original-superseded",
      type: "capability.superseded",
      kind: "user_interpretation",
      createdAt: "2026-07-20T08:01:00.000Z",
      actor: "human",
      summary: "Superseded the prior capability version.",
      sourceIds: original.manifest.sourceIds,
      payload: {
        capabilityId: original.manifest.id,
        replacementCapabilityId: "value-density-reviewer-0.2.0",
        reason: "The replacement addresses the recorded revision request."
      }
    };

    const projected = reduceWorkspace([...seedEvents, replacementRegistration, supersession]);
    expect(
      projected.capabilities.find((capability) => capability.manifest.id === original.manifest.id)?.manifest.status
    ).toBe("superseded");

    const unrelatedRegistration: EvidenceEvent = {
      ...replacementRegistration,
      id: "evt-capability-unrelated-registered",
      payload: {
        manifest: {
          ...original.manifest,
          id: "value-density-reviewer-unrelated",
          version: "unrelated",
          status: "draft",
          supersedesCapabilityId: "density-linter"
        }
      }
    };
    const unrelatedSupersession: EvidenceEvent = {
      ...supersession,
      payload: {
        capabilityId: original.manifest.id,
        replacementCapabilityId: "value-density-reviewer-unrelated",
        reason: "This unrelated capability must not supersede the original."
      }
    };
    expect(() => reduceWorkspace([...seedEvents, unrelatedRegistration, unrelatedSupersession])).toThrow(
      "is not registered as a revision"
    );
  });
});
