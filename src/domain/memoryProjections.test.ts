import { describe, expect, it } from "vitest";
import { preparedDensityMicroWorld, seedEvents } from "../data/sample";
import { evaluateMicroWorld } from "./microWorld";
import type { EvidenceEvent } from "./types";
import { reduceWorkspace } from "./workspaceProjection";

function microWorldEvidence(): EvidenceEvent[] {
  const initialValues = Object.fromEntries(
    preparedDensityMicroWorld.variables.map((variable) => [variable.id, variable.initialValue])
  );
  const changedValues = { ...initialValues, "queue-spacing": 10 };
  const interactionId = "evt-memory-micro-world-interaction";

  return [
    {
      id: "evt-memory-micro-world-prediction",
      type: "learning.micro_world_prediction_recorded",
      kind: "hypothesis",
      createdAt: "2026-07-14T11:20:00.000Z",
      actor: "human",
      summary: "Predicted the queue-density outcome.",
      sourceIds: preparedDensityMicroWorld.sourceIds,
      payload: {
        artifactId: preparedDensityMicroWorld.id,
        optionId: preparedDensityMicroWorld.prediction.options[0]?.id,
        variableValues: initialValues
      }
    },
    {
      id: interactionId,
      type: "learning.micro_world_interaction_recorded",
      kind: "practical_observation",
      createdAt: "2026-07-14T11:21:00.000Z",
      actor: "human",
      summary: "Recorded a changed queue configuration.",
      sourceIds: preparedDensityMicroWorld.sourceIds,
      payload: {
        artifactId: preparedDensityMicroWorld.id,
        variableValues: changedValues,
        changedVariableIds: ["queue-spacing"],
        outcomeValues: evaluateMicroWorld(preparedDensityMicroWorld, changedValues)
      }
    },
    {
      id: "evt-memory-micro-world-reflection",
      type: "learning.micro_world_reflection_recorded",
      kind: "user_interpretation",
      createdAt: "2026-07-14T11:22:00.000Z",
      actor: "human",
      summary: "Reflected on the recorded queue trade-off.",
      sourceIds: preparedDensityMicroWorld.sourceIds,
      payload: {
        artifactId: preparedDensityMicroWorld.id,
        prompt: preparedDensityMicroWorld.reflectionPrompts[0],
        response: "More capacity did not remove the need for hierarchy and accessible targets.",
        interactionEventId: interactionId
      }
    }
  ];
}

function evidenceIds(projection: {
  supportingEvidence: Array<{ eventId: string }>;
  contradictoryEvidence: Array<{ eventId: string }>;
}) {
  return [
    ...projection.supportingEvidence.map((reference) => reference.eventId),
    ...projection.contradictoryEvidence.map((reference) => reference.eventId)
  ];
}

describe("memory projections", () => {
  it("keeps human dimensions separate and never exposes a mastery score", () => {
    const workspace = reduceWorkspace(seedEvents);
    const valueDensity = workspace.memories.human.elements.find(
      (element) => element.theoryElementId === "theory-concept-value-density"
    );

    expect(Object.keys(valueDensity?.dimensions ?? {})).toEqual([
      "recall",
      "explanation",
      "prediction",
      "transfer",
      "participation",
      "uncertainty"
    ]);
    expect(valueDensity?.dimensions.recall.supportingEvidence).toHaveLength(1);
    expect(valueDensity?.dimensions.transfer.freshness).toBe("unobserved");
    expect(JSON.stringify(workspace.memories)).not.toContain("mastery");
  });

  it("projects prediction, committed interaction, and linked reflection as distinct evidence", () => {
    const workspace = reduceWorkspace([...seedEvents, ...microWorldEvidence()]);
    const element = workspace.memories.human.elements.find(
      (candidate) => candidate.theoryElementId === preparedDensityMicroWorld.theoryElementIds[0]
    );

    expect(element?.dimensions.prediction.mixedEvidence.map((reference) => reference.eventId)).toContain(
      "evt-memory-micro-world-prediction"
    );
    expect(element?.dimensions.participation.supportingEvidence.map((reference) => reference.eventId)).toEqual(
      expect.arrayContaining(["evt-memory-micro-world-interaction", "evt-memory-micro-world-reflection"])
    );
    expect(
      element?.dimensions.participation.supportingEvidence.find(
        (reference) => reference.eventId === "evt-memory-micro-world-reflection"
      )?.rationale
    ).toContain("evt-memory-micro-world-interaction");
    expect(
      element?.dimensions.participation.supportingEvidence.find(
        (reference) => reference.eventId === "evt-memory-micro-world-interaction"
      )
    ).not.toHaveProperty("outcomeValues");
  });

  it("does not treat unrecorded micro-world exploration as participation", () => {
    const workspace = reduceWorkspace(seedEvents);
    expect(
      workspace.memories.human.elements.every(
        (element) => element.dimensions.participation.supportingEvidence.length === 0
      )
    ).toBe(true);
  });

  it("keeps capability success and failure out of human understanding", () => {
    const prepared = reduceWorkspace(seedEvents);
    const capability = prepared.capabilities.find((item) => item.manifest.type === "skill");
    if (!capability) throw new Error("Prepared skill capability is missing");
    const failure: EvidenceEvent = {
      id: "evt-memory-capability-partial-evaluation",
      type: "capability.evaluation_recorded",
      kind: "validated_behavior",
      createdAt: "2026-07-14T11:30:00.000Z",
      actor: "system",
      summary: "One capability evaluation case failed.",
      sourceIds: capability.manifest.sourceIds,
      payload: { capabilityId: capability.manifest.id, evaluation: { passed: 7, total: 8 } }
    };
    const workspace = reduceWorkspace([...seedEvents, failure]);

    expect(workspace.memories.agent.failures[0]?.evidence.eventId).toBe(failure.id);
    expect(workspace.memories.agent.contradictoryEvidence.map((reference) => reference.eventId)).toContain(failure.id);
    expect(evidenceIds(workspace.memories.human)).not.toContain(failure.id);
  });

  it("shows unresolved, contradictory, and stale shared-theory state deterministically", () => {
    const contradiction: EvidenceEvent = {
      id: "evt-memory-theory-contradiction",
      type: "theory.relationship_recorded",
      kind: "user_interpretation",
      createdAt: "2026-07-14T11:25:00.000Z",
      actor: "human",
      summary: "Recorded a contradiction between capacity and accessibility.",
      sourceIds: [],
      payload: {
        relationship: {
          id: "relationship-memory-contradiction",
          kind: "contradicts",
          fromElementId: "theory-concept-value-density",
          toElementId: "theory-boundary-accessibility",
          sourceIds: [],
          fragmentIds: [],
          evidenceEventIds: []
        }
      }
    };
    const laterLedgerEvent: EvidenceEvent = {
      id: "evt-memory-later-ledger-time",
      type: "workspace.observed",
      kind: "practical_observation",
      createdAt: "2026-09-20T12:00:00.000Z",
      actor: "system",
      summary: "Advanced the deterministic ledger observation time.",
      sourceIds: [],
      payload: {}
    };
    const workspace = reduceWorkspace([...seedEvents, contradiction, laterLedgerEvent]);
    const contested = workspace.memories.shared.elements.find(
      (element) => element.theoryElementId === "theory-concept-value-density"
    );

    expect(contested?.agreement).toBe("contested");
    expect(contested?.contradictoryEvidence.map((reference) => reference.eventId)).toContain(contradiction.id);
    expect(workspace.memories.shared.unresolvedTheoryElementIds).toContain("theory-question-audience");
    expect(workspace.memories.human.staleTheoryElementIds.length).toBeGreaterThan(0);
    expect(workspace.memories.shared.staleTheoryElementIds).toContain("theory-concept-value-density");
    expect(workspace.memories.asOf).toBe(laterLedgerEvent.createdAt);
  });
});
