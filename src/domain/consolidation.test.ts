import { describe, expect, it } from "vitest";
import { seedEvents } from "../data/sample";
import { consolidationProposedPayloadSchema, generateConsolidationProposal } from "./consolidation";
import { evaluateMicroWorld } from "./microWorld";
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

function activeCapabilityEvents() {
  const capability = reduceWorkspace(seedEvents).capabilities[0];
  const approval: EvidenceEvent = {
    id: "evt-consolidation-test-approval",
    type: "capability.activation_decided",
    kind: "user_interpretation",
    createdAt: "2026-07-20T12:00:00.000Z",
    actor: "human",
    summary: "Approved the prepared capability for consolidation testing.",
    sourceIds: capability.manifest.sourceIds,
    payload: {
      capabilityId: capability.manifest.id,
      decision: "approved",
      reason: "The prepared gate evidence is sufficient.",
      gateEvidenceEventIds: gateEvidenceEventIds(capability)
    }
  };
  const activation: EvidenceEvent = {
    id: "evt-consolidation-test-activation",
    type: "capability.activated",
    kind: "user_interpretation",
    createdAt: "2026-07-20T12:01:00.000Z",
    actor: "human",
    summary: "Activated the prepared capability for consolidation testing.",
    sourceIds: capability.manifest.sourceIds,
    payload: {
      capabilityId: capability.manifest.id,
      approvalEventId: approval.id,
      reason: "Apply the skill to the prepared project."
    }
  };
  return [...seedEvents, approval, activation];
}

function practicalEvents() {
  const activeEvents = activeCapabilityEvents();
  const capability = reduceWorkspace(activeEvents).capabilities[0];
  const application: EvidenceEvent = {
    id: "evt-consolidation-test-application",
    type: "practical.application_recorded",
    kind: "practical_observation",
    createdAt: "2026-07-20T12:02:00.000Z",
    actor: "agent",
    summary: "Applied the density review skill to the Learning Foundry queue.",
    sourceIds: capability.manifest.sourceIds,
    payload: {
      capabilityId: capability.manifest.id,
      capabilityVersion: capability.manifest.version,
      inputSummary: "Review the active Learning Foundry queue.",
      outputSummary: "Recommended reducing spacing everywhere.",
      outcome: "partial",
      theoryElementIds: capability.manifest.theoryElementIds
    }
  };
  const correction: EvidenceEvent = {
    id: "evt-consolidation-test-correction",
    type: "practical.correction_recorded",
    kind: "user_interpretation",
    createdAt: "2026-07-20T12:03:00.000Z",
    actor: "human",
    summary: "Corrected the practical density recommendation.",
    sourceIds: capability.manifest.sourceIds,
    payload: {
      subjectEventId: application.id,
      capabilityId: capability.manifest.id,
      kind: "correction",
      content: "Preserve spacing that communicates grouping; reduce only space that carries no meaning.",
      theoryElementIds: ["theory-concept-meaning-density"]
    }
  };
  return { events: [...activeEvents, application, correction], application, correction };
}

function proposalEvent(events: EvidenceEvent[], trigger: EvidenceEvent) {
  const workspace = reduceWorkspace(events);
  const proposal = generateConsolidationProposal({
    proposalId: "consolidation-practical-test",
    createdAt: "2026-07-20T12:04:00.000Z",
    triggerEvents: [trigger],
    theory: workspace.theory,
    capabilities: workspace.capabilities,
    checks: workspace.understandingChecks,
    microWorlds: workspace.microWorlds
  });
  const event: EvidenceEvent = {
    id: "evt-consolidation-proposal-test",
    type: "consolidation.proposed",
    kind: "agent_synthesis",
    createdAt: proposal.createdAt,
    actor: "agent",
    summary: "Proposed practical evidence consolidation.",
    sourceIds: [...new Set([...trigger.sourceIds, ...proposal.capabilityRevisions.flatMap((item) => item.sourceIds)])],
    payload: consolidationProposedPayloadSchema.parse({ proposal })
  };
  return { proposal, event };
}

describe("practical evidence consolidation", () => {
  it("keeps application, feedback, and proposals traceable without changing approved state", () => {
    const { events, application, correction } = practicalEvents();
    const { proposal, event } = proposalEvent(events, correction);
    const pending = reduceWorkspace([...events, event]);

    expect(pending.practicalEvidence.applications[0]).toMatchObject({
      evidenceEventId: application.id,
      outcome: "partial"
    });
    expect(pending.practicalEvidence.feedback[0]).toMatchObject({
      evidenceEventId: correction.id,
      subjectEventId: application.id
    });
    expect(pending.capabilities[0].executions).toBe(1);
    expect(pending.consolidationProposals[0]).toMatchObject({ id: proposal.id, status: "pending" });
    expect(pending.targetedReviewItems).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: proposal.reviewItems[0]?.id })])
    );
    expect(pending.memories.agent.contradictoryEvidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ eventId: application.id }),
        expect.objectContaining({ eventId: correction.id })
      ])
    );
    expect(pending.memories.human.mixedEvidence).toEqual(
      expect.arrayContaining([expect.objectContaining({ eventId: correction.id })])
    );
    expect(pending.theory.elements.some((element) => element.id === proposal.theoryRevisions[0]?.id)).toBe(false);
    expect(
      pending.capabilities.some((capability) => capability.manifest.id === proposal.capabilityRevisions[0]?.id)
    ).toBe(false);
  });

  it("rejects practical feedback that substitutes unrelated theory context", () => {
    const { events } = practicalEvents();
    const unrelated = structuredClone(events);
    const correction = unrelated.at(-1);
    if (!correction) throw new Error("Prepared correction missing");
    correction.payload.theoryElementIds = ["theory-question-audience"];

    expect(() => reduceWorkspace(unrelated)).toThrow("does not match its subject theory context");
  });

  it("applies approved revisions as new versions while preserving their predecessors", () => {
    const { events, correction } = practicalEvents();
    const { proposal, event } = proposalEvent(events, correction);
    const review: EvidenceEvent = {
      id: "evt-consolidation-review-approved-test",
      type: "consolidation.reviewed",
      kind: "user_interpretation",
      createdAt: "2026-07-20T12:05:00.000Z",
      actor: "human",
      summary: "Approved the practical consolidation proposal.",
      sourceIds: event.sourceIds,
      payload: {
        proposalId: proposal.id,
        decision: "approved",
        reason: "The correction and follow-up are grounded in the recorded application."
      }
    };
    const replayEvents = [...events, event, review];
    const approved = reduceWorkspace(replayEvents);
    const previousTheory = approved.theory.elements.find(
      (element) => element.id === proposal.theoryRevisions[0]?.revisesElementId
    );
    const revisedTheory = approved.theory.elements.find((element) => element.id === proposal.theoryRevisions[0]?.id);
    const previousCapability = approved.capabilities.find(
      (capability) => capability.manifest.id === proposal.capabilityRevisions[0]?.supersedesCapabilityId
    );
    const revisedCapability = approved.capabilities.find(
      (capability) => capability.manifest.id === proposal.capabilityRevisions[0]?.id
    );

    expect(previousTheory?.status).toBe("superseded");
    expect(revisedTheory).toMatchObject({
      status: "active",
      revisesElementId: previousTheory?.id,
      evidenceEventIds: expect.arrayContaining([correction.id, review.id])
    });
    expect(previousCapability?.manifest.status).toBe("active");
    expect(revisedCapability?.manifest).toMatchObject({
      status: "draft",
      supersedesCapabilityId: previousCapability?.manifest.id
    });
    expect(revisedCapability?.activation).toBeNull();
    expect(reduceWorkspace(structuredClone(replayEvents))).toEqual(approved);
  });

  it("retains rejected proposals as evidence without applying any proposed revision", () => {
    const { events, correction } = practicalEvents();
    const { proposal, event } = proposalEvent(events, correction);
    const review: EvidenceEvent = {
      id: "evt-consolidation-review-rejected-test",
      type: "consolidation.reviewed",
      kind: "user_interpretation",
      createdAt: "2026-07-20T12:05:00.000Z",
      actor: "human",
      summary: "Rejected the practical consolidation proposal.",
      sourceIds: event.sourceIds,
      payload: {
        proposalId: proposal.id,
        decision: "rejected",
        reason: "The practical correction needs another observation before revising shared theory."
      }
    };
    const rejected = reduceWorkspace([...events, event, review]);

    expect(rejected.consolidationProposals[0]).toMatchObject({ status: "rejected" });
    expect(rejected.targetedReviewItems.some((item) => item.id === proposal.reviewItems[0]?.id)).toBe(false);
    expect(rejected.theory.elements.some((element) => element.id === proposal.theoryRevisions[0]?.id)).toBe(false);
    expect(
      rejected.capabilities.some((capability) => capability.manifest.id === proposal.capabilityRevisions[0]?.id)
    ).toBe(false);
  });

  it("turns a recorded micro-world observation into targeted review without mutating the artifact", () => {
    const base = reduceWorkspace(seedEvents);
    const world = base.microWorlds[0];
    const variable = world.variables[0];
    const variableValues = Object.fromEntries(world.variables.map((item) => [item.id, item.initialValue]));
    variableValues[variable.id] = variable.initialValue + variable.step;
    const prediction: EvidenceEvent = {
      id: "evt-consolidation-micro-prediction",
      type: "learning.micro_world_prediction_recorded",
      kind: "hypothesis",
      createdAt: "2026-07-20T12:00:00.000Z",
      actor: "human",
      summary: "Predicted the changed micro-world configuration.",
      sourceIds: world.sourceIds,
      payload: { artifactId: world.id, optionId: world.prediction.options[0].id, variableValues }
    };
    const interaction: EvidenceEvent = {
      id: "evt-consolidation-micro-interaction",
      type: "learning.micro_world_interaction_recorded",
      kind: "practical_observation",
      createdAt: "2026-07-20T12:01:00.000Z",
      actor: "human",
      summary: "Recorded the changed micro-world configuration.",
      sourceIds: world.sourceIds,
      payload: {
        artifactId: world.id,
        predictionEventId: prediction.id,
        variableValues,
        changedVariableIds: [variable.id],
        outcomeValues: evaluateMicroWorld(world, variableValues)
      }
    };
    const events = [...seedEvents, prediction, interaction];
    const workspace = reduceWorkspace(events);
    const proposal = generateConsolidationProposal({
      proposalId: "consolidation-micro-test",
      createdAt: "2026-07-20T12:02:00.000Z",
      triggerEvents: [interaction],
      theory: workspace.theory,
      capabilities: workspace.capabilities,
      checks: workspace.understandingChecks,
      microWorlds: workspace.microWorlds
    });

    expect(proposal.reviewItems).toHaveLength(1);
    expect(proposal.theoryRevisions).toHaveLength(0);
    expect(proposal.capabilityRevisions).toHaveLength(0);
    expect(workspace.microWorlds[0]).toMatchObject({ id: world.id, title: world.title });
  });
});
