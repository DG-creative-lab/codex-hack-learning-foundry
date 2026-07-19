import { describe, expect, it } from "vitest";
import { preparedDensityMicroWorld, seedEvents } from "../data/sample";
import { evaluateMicroWorld } from "./microWorld";
import type { EvidenceEvent } from "./types";
import { createProvisionalEvaluation } from "./understandingCheckGeneration";
import { reduceWorkspace } from "./workspaceProjection";

function microWorldMismatchEvents(): EvidenceEvent[] {
  const initialValues = Object.fromEntries(
    preparedDensityMicroWorld.variables.map((variable) => [variable.id, variable.initialValue])
  );
  const changedValues = { ...initialValues, "queue-spacing": 8, "queue-information": 7 };
  return [
    {
      id: "evt-gap-micro-prediction",
      type: "learning.micro_world_prediction_recorded",
      kind: "hypothesis",
      createdAt: "2026-07-14T12:20:00.000Z",
      actor: "human",
      summary: "Predicted that capacity and scanning would both improve.",
      sourceIds: preparedDensityMicroWorld.sourceIds,
      payload: {
        artifactId: preparedDensityMicroWorld.id,
        optionId: "prediction-faster",
        variableValues: initialValues
      }
    },
    {
      id: "evt-gap-micro-interaction",
      type: "learning.micro_world_interaction_recorded",
      kind: "practical_observation",
      createdAt: "2026-07-14T12:21:00.000Z",
      actor: "human",
      summary: "Recorded the denser queue configuration.",
      sourceIds: preparedDensityMicroWorld.sourceIds,
      payload: {
        artifactId: preparedDensityMicroWorld.id,
        variableValues: changedValues,
        changedVariableIds: ["queue-spacing", "queue-information"],
        outcomeValues: evaluateMicroWorld(preparedDensityMicroWorld, changedValues)
      }
    },
    {
      id: "evt-gap-micro-reflection",
      type: "learning.micro_world_reflection_recorded",
      kind: "user_interpretation",
      createdAt: "2026-07-14T12:22:00.000Z",
      actor: "human",
      summary: "Reflected on the prediction mismatch.",
      sourceIds: preparedDensityMicroWorld.sourceIds,
      payload: {
        artifactId: preparedDensityMicroWorld.id,
        prompt: preparedDensityMicroWorld.reflectionPrompts[0],
        response: "Capacity improved, but the modeled scan effort also increased.",
        interactionEventId: "evt-gap-micro-interaction"
      }
    }
  ];
}

describe("understanding-gap projection", () => {
  it("explains prepared prediction and transfer gaps without claiming a cognitive measure", () => {
    const projection = reduceWorkspace(seedEvents).understandingGaps;

    expect(projection.gaps.map((gap) => gap.kind)).toEqual(
      expect.arrayContaining(["low_prediction_evidence", "low_transfer_evidence"])
    );
    expect(projection.gaps.every((gap) => gap.evidence.length > 0)).toBe(true);
    expect(projection.gaps.every((gap) => gap.id.length <= 480)).toBe(true);
    expect(projection.gaps.every((gap) => gap.affectedTheoryElementIds.length > 0)).toBe(true);
    expect(projection.gaps.every((gap) => gap.caveat.includes("does not measure cognition"))).toBe(true);
    expect(projection.gaps.some((gap) => gap.kind === "micro_world_mismatch")).toBe(false);
    const predictionGap = projection.gaps.find((gap) => gap.kind === "low_prediction_evidence");
    const predictionCheck = reduceWorkspace(seedEvents).understandingChecks.find(
      (check) => check.kind === "prediction"
    );
    expect(predictionGap?.recommendedIntervention.destination).toEqual({
      kind: "check",
      view: "learn",
      id: predictionCheck?.id
    });
  });

  it("removes the prepared transfer gap after an inspectable transfer response", () => {
    const prepared = reduceWorkspace(seedEvents);
    const transfer = prepared.understandingChecks.find((check) => check.kind === "transfer");
    if (!transfer) throw new Error("Prepared transfer check is missing");
    const response = {
      answer:
        "Preserve target size and urgency cues, then reduce repeated context only after observing whether expert operators can still recover from errors efficiently.",
      confidence: "medium" as const,
      sourceSupport: { level: "reasoned" as const, sourceIds: [], fragmentIds: [] }
    };
    const attempt: EvidenceEvent = {
      id: "evt-gap-transfer-attempt",
      type: "learning.understanding_attempt_recorded",
      kind: "practical_observation",
      createdAt: "2026-07-14T12:20:00.000Z",
      actor: "human",
      summary: "Applied the density model to the transfer task.",
      sourceIds: transfer.sourceIds,
      payload: { checkId: transfer.id, response, evaluation: createProvisionalEvaluation(transfer, response) }
    };
    const after = reduceWorkspace([...seedEvents, attempt]);

    expect(prepared.understandingGaps.gaps.some((gap) => gap.kind === "low_transfer_evidence")).toBe(true);
    expect(after.understandingGaps.gaps.some((gap) => gap.kind === "low_transfer_evidence")).toBe(false);
  });

  it("links micro-world prediction, observation, and reflection as separate evidence", () => {
    const workspace = reduceWorkspace([...seedEvents, ...microWorldMismatchEvents()]);
    const gap = workspace.understandingGaps.gaps.find((candidate) => candidate.kind === "micro_world_mismatch");

    expect(gap?.level).toBe("notice");
    expect(gap?.evidence.map((reference) => reference.eventId)).toEqual([
      "evt-gap-micro-prediction",
      "evt-gap-micro-interaction",
      "evt-gap-micro-reflection"
    ]);
    expect(gap?.why).toContain("model output");
  });

  it("detects bounded architecture signals from canonical theory and capability events", () => {
    const sourceId = "source-ui-density-2024";
    const events: EvidenceEvent[] = [
      {
        id: "evt-gap-decision",
        type: "theory.element_recorded",
        kind: "agent_synthesis",
        createdAt: "2026-07-14T12:30:00.000Z",
        actor: "agent",
        summary: "Recorded an agent-authored queue decision.",
        sourceIds: [sourceId],
        payload: {
          element: {
            id: "theory-gap-decision",
            kind: "decision",
            title: "Compress repeated queue context",
            statement: "Repeated context should be compressed after the first row.",
            epistemicKind: "agent_synthesis",
            status: "active",
            sourceIds: [sourceId],
            fragmentIds: [],
            evidenceEventIds: []
          }
        }
      },
      {
        id: "evt-gap-dependency",
        type: "theory.relationship_recorded",
        kind: "agent_synthesis",
        createdAt: "2026-07-14T12:31:00.000Z",
        actor: "agent",
        summary: "Linked the decision to the value purpose.",
        sourceIds: [sourceId],
        payload: {
          relationship: {
            id: "relationship-gap-dependency",
            kind: "depends-on",
            fromElementId: "theory-gap-decision",
            toElementId: "theory-purpose-review-value",
            sourceIds: [sourceId],
            fragmentIds: [],
            evidenceEventIds: []
          }
        }
      },
      {
        id: "evt-gap-contradiction",
        type: "theory.relationship_recorded",
        kind: "user_interpretation",
        createdAt: "2026-07-14T12:32:00.000Z",
        actor: "human",
        summary: "Recorded a contradiction involving queue compression.",
        sourceIds: [],
        payload: {
          relationship: {
            id: "relationship-gap-contradiction",
            kind: "contradicts",
            fromElementId: "theory-gap-decision",
            toElementId: "theory-boundary-accessibility",
            sourceIds: [],
            fragmentIds: [],
            evidenceEventIds: []
          }
        }
      },
      {
        id: "evt-gap-revised-capability",
        type: "capability.registered",
        kind: "agent_synthesis",
        createdAt: "2026-07-14T12:33:00.000Z",
        actor: "agent",
        summary: "Registered an unevaluated revised capability.",
        sourceIds: [sourceId],
        payload: {
          manifest: {
            id: "capability-gap-revised",
            type: "skill",
            name: "revised-density-review",
            version: "2.0.0",
            status: "revised",
            createdAt: "2026-07-14T12:33:00.000Z",
            sourceIds: [sourceId],
            assumptions: ["The queue vocabulary is stable."],
            limitations: ["The revision has not been evaluated."],
            skillPath: "skills/revised-density-review/SKILL.md"
          }
        }
      },
      {
        id: "evt-gap-later-observation",
        type: "workspace.observed",
        kind: "practical_observation",
        createdAt: "2026-09-20T12:00:00.000Z",
        actor: "system",
        summary: "Advanced the deterministic observation date.",
        sourceIds: [],
        payload: {}
      }
    ];
    const kinds = reduceWorkspace([...seedEvents, ...events]).understandingGaps.gaps.map((gap) => gap.kind);

    expect(kinds).toEqual(
      expect.arrayContaining([
        "unexplained_decision",
        "stale_theory",
        "black_box_capability_revision",
        "unresolved_contradiction",
        "agent_only_dependency"
      ])
    );
  });

  it("recognizes a human-authored decision-because relationship as canonical explanation evidence", () => {
    const sourceId = "source-ui-density-2024";
    const decision: EvidenceEvent = {
      id: "evt-explained-decision",
      type: "theory.element_recorded",
      kind: "agent_synthesis",
      createdAt: "2026-07-14T12:30:00.000Z",
      actor: "agent",
      summary: "Recorded a queue context decision.",
      sourceIds: [sourceId],
      payload: {
        element: {
          id: "theory-explained-decision",
          kind: "decision",
          title: "Compress repeated queue context",
          statement: "Repeated context should be compressed after the first row.",
          epistemicKind: "agent_synthesis",
          status: "active",
          sourceIds: [sourceId],
          fragmentIds: [],
          evidenceEventIds: []
        }
      }
    };
    const explanation: EvidenceEvent = {
      id: "evt-human-decision-explanation",
      type: "theory.relationship_recorded",
      kind: "user_interpretation",
      createdAt: "2026-07-14T12:31:00.000Z",
      actor: "human",
      summary: "Explained the queue context decision.",
      sourceIds: [sourceId],
      payload: {
        relationship: {
          id: "relationship-human-decision-because",
          kind: "decision-because",
          fromElementId: "theory-explained-decision",
          toElementId: "theory-purpose-review-value",
          sourceIds: [sourceId],
          fragmentIds: [],
          evidenceEventIds: []
        }
      }
    };
    const gaps = reduceWorkspace([...seedEvents, decision, explanation]).understandingGaps.gaps;

    expect(
      gaps.some(
        (gap) =>
          gap.kind === "unexplained_decision" && gap.affectedTheoryElementIds.includes("theory-explained-decision")
      )
    ).toBe(false);
  });

  it("retains an agent-only decision explanation as inspectable gap evidence", () => {
    const sourceId = "source-ui-density-2024";
    const decision: EvidenceEvent = {
      id: "evt-agent-explained-decision",
      type: "theory.element_recorded",
      kind: "agent_synthesis",
      createdAt: "2026-07-14T12:30:00.000Z",
      actor: "agent",
      summary: "Recorded an agent-explained decision.",
      sourceIds: [sourceId],
      payload: {
        element: {
          id: "theory-agent-explained-decision",
          kind: "decision",
          title: "Compress repeated status labels",
          statement: "Repeated status labels should be compressed.",
          epistemicKind: "agent_synthesis",
          status: "active",
          sourceIds: [sourceId],
          fragmentIds: [],
          evidenceEventIds: []
        }
      }
    };
    const explanation: EvidenceEvent = {
      id: "evt-agent-decision-explanation",
      type: "theory.relationship_recorded",
      kind: "agent_synthesis",
      createdAt: "2026-07-14T12:31:00.000Z",
      actor: "agent",
      summary: "Linked an agent rationale to the decision.",
      sourceIds: [sourceId],
      payload: {
        relationship: {
          id: "relationship-agent-decision-because",
          kind: "decision-because",
          fromElementId: "theory-agent-explained-decision",
          toElementId: "theory-purpose-review-value",
          sourceIds: [sourceId],
          fragmentIds: [],
          evidenceEventIds: []
        }
      }
    };
    const gap = reduceWorkspace([...seedEvents, decision, explanation]).understandingGaps.gaps.find(
      (candidate) =>
        candidate.kind === "unexplained_decision" &&
        candidate.affectedTheoryElementIds.includes("theory-agent-explained-decision")
    );

    expect(gap?.evidence.map((reference) => reference.eventId)).toContain(explanation.id);
    expect(gap?.recommendedIntervention.destination).toEqual({
      kind: "theory-element",
      view: "memory",
      id: "theory-agent-explained-decision"
    });
  });

  it("projects review and annotation events without changing detector evidence", () => {
    const before = reduceWorkspace(seedEvents);
    const gap = before.understandingGaps.gaps.find((candidate) => candidate.kind === "low_transfer_evidence");
    if (!gap) throw new Error("Prepared transfer gap is missing");
    const sourceIds = [...new Set(gap.evidence.flatMap((reference) => reference.sourceIds))];
    const review: EvidenceEvent = {
      id: "evt-gap-review",
      type: "memory.understanding_gap_reviewed",
      kind: "user_interpretation",
      createdAt: "2026-07-14T12:20:00.000Z",
      actor: "human",
      summary: "Confirmed the transfer evidence gap.",
      sourceIds,
      payload: { gapId: gap.id, decision: "confirmed", reason: "This is relevant to the active project." }
    };
    const annotation: EvidenceEvent = {
      id: "evt-gap-annotation",
      type: "memory.understanding_gap_annotated",
      kind: "user_interpretation",
      createdAt: "2026-07-14T12:21:00.000Z",
      actor: "human",
      summary: "Added context to the transfer evidence gap.",
      sourceIds,
      payload: { gapId: gap.id, note: "Use the prepared unfamiliar queue task." }
    };
    const after = reduceWorkspace([...seedEvents, review, annotation]);
    const projected = after.understandingGaps.gaps.find((candidate) => candidate.id === gap.id);

    expect(projected?.status).toBe("confirmed");
    expect(projected?.review?.evidenceEventId).toBe(review.id);
    expect(projected?.annotations[0]?.evidenceEventId).toBe(annotation.id);
    expect(projected?.evidence.map((reference) => reference.eventId)).toEqual(
      gap.evidence.map((reference) => reference.eventId)
    );

    expect(() =>
      reduceWorkspace([...seedEvents, { ...review, id: "evt-gap-review-missing-provenance", sourceIds: [] }])
    ).toThrow("missing provenance");
  });
});
