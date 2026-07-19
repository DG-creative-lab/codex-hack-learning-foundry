import { describe, expect, it } from "vitest";
import { seedEvents } from "../data/sample";
import type { EvidenceEvent } from "./types";
import { createProvisionalEvaluation, generateUnderstandingChecks } from "./understandingCheckGeneration";
import { deriveUnderstandingChecks } from "./understandingCheckProjection";
import type { UnderstandingCheck, UnderstandingEvaluation, UnderstandingResponse } from "./understandingChecks";
import { reduceWorkspace } from "./workspaceProjection";

const activeProject = {
  name: "Learning Foundry",
  goal: "Preserve useful context while reducing avoidable time and attention.",
  transferScenario: "An expert operator must triage an unfamiliar queue without losing urgency or recovery context."
};

function fixture() {
  const workspace = reduceWorkspace(seedEvents);
  const checks = generateUnderstandingChecks({ theory: workspace.theory, activeProject });
  const context = {
    sourceIds: new Set(workspace.sources.map((source) => source.id)),
    fragments: new Map(workspace.sourceFragments.map((fragment) => [fragment.id, fragment])),
    theoryElementIds: new Set(workspace.theory.elements.map((element) => element.id))
  };
  return { workspace, checks, context };
}

function registration(check: UnderstandingCheck): EvidenceEvent {
  return {
    id: `evt-register-${check.id}`,
    type: "learning.understanding_check_registered",
    kind: "agent_synthesis",
    createdAt: "2026-07-19T13:00:00.000Z",
    actor: "agent",
    summary: `Registered ${check.kind} check.`,
    sourceIds: check.sourceIds,
    payload: { check }
  };
}

const response: UnderstandingResponse = {
  answer: "The five lenses separate visual load, information, meaning, workflow time, and useful outcome.",
  confidence: "medium",
  sourceSupport: { level: "reasoned", sourceIds: [], fragmentIds: [] }
};

function supportedEvaluation(check: UnderstandingCheck): UnderstandingEvaluation {
  return {
    outcome: "supported",
    evaluator: "prepared",
    feedback: "The response reconstructs the distinctions without relying on the original wording.",
    signals: [
      {
        dimension: check.kind === "transfer" ? "transfer" : "retrieval",
        signal: "supports",
        rationale: "The response makes the relevant distinction available for action.",
        theoryElementIds: check.theoryElementIds
      }
    ],
    reviewItems: []
  };
}

function attempt(
  check: UnderstandingCheck,
  evaluation: UnderstandingEvaluation,
  id = `evt-attempt-${check.id}`
): EvidenceEvent {
  return {
    id,
    type: "learning.understanding_attempt_recorded",
    kind: "practical_observation",
    createdAt: "2026-07-19T13:05:00.000Z",
    actor: "human",
    summary: `Responded to ${check.kind} check.`,
    sourceIds: check.sourceIds,
    payload: { checkId: check.id, response, evaluation }
  };
}

describe("understanding checks", () => {
  it("generates all five check types from the Living Theory and active project", () => {
    const { checks } = fixture();

    expect(checks.map((check) => check.kind)).toEqual([
      "recall",
      "explanation",
      "prediction",
      "teach_back",
      "transfer"
    ]);
    expect(checks.every((check) => check.projectContext.includes(activeProject.name))).toBe(true);
    expect(checks.every((check) => check.theoryElementIds.length > 0 && check.sourceIds.length > 0)).toBe(true);
    expect(checks.flatMap((check) => check.theoryElementIds)).toEqual(
      expect.arrayContaining([
        "theory-purpose-review-value",
        "theory-concept-value-density",
        "theory-boundary-accessibility"
      ])
    );
  });

  it("rotates prompt framing and cue variants between cycles", () => {
    const { workspace, checks } = fixture();
    const nextCycle = generateUnderstandingChecks({ theory: workspace.theory, activeProject, cycle: 2 });

    expect(nextCycle.map((check) => check.prompt)).not.toEqual(checks.map((check) => check.prompt));
    expect(nextCycle.map((check) => check.cue.variant)).not.toEqual(checks.map((check) => check.cue.variant));
  });

  it("keeps supported recall separate from unobserved prediction and transfer", () => {
    const { checks, context } = fixture();
    const recall = checks[0];
    const projection = deriveUnderstandingChecks(
      [registration(recall), attempt(recall, supportedEvaluation(recall))],
      context
    );
    const vector = projection.evidenceVectors.find((item) => item.theoryElementId === recall.theoryElementIds[0]);

    expect(vector?.dimensions.retrieval.supports).toBe(1);
    expect(vector?.dimensions.prediction.supports).toBe(0);
    expect(vector?.dimensions.transfer.supports).toBe(0);
    expect(vector).not.toHaveProperty("mastery");
  });

  it("projects provenance-backed review work and removes disputed evaluations from the vector", () => {
    const { checks, context } = fixture();
    const prediction = checks.find((check) => check.kind === "prediction");
    if (!prediction) throw new Error("Prediction check missing");
    const shortResponse = { ...response, answer: "It would get worse." };
    const evaluation = createProvisionalEvaluation(prediction, shortResponse);
    const attemptEvent = attempt(prediction, evaluation, "evt-attempt-prediction");
    const beforeDispute = deriveUnderstandingChecks([registration(prediction), attemptEvent], context);

    expect(beforeDispute.reviewItems[0]).toMatchObject({
      checkId: prediction.id,
      attemptEventId: attemptEvent.id
    });
    expect(beforeDispute.reviewItems[0]?.sourceIds.length).toBeGreaterThan(0);
    expect(beforeDispute.evidenceVectors[0]?.dimensions.prediction.challenges).toBe(1);

    const dispute: EvidenceEvent = {
      id: "evt-dispute-prediction",
      type: "learning.understanding_evaluation_disputed",
      kind: "user_interpretation",
      createdAt: "2026-07-19T13:10:00.000Z",
      actor: "human",
      summary: "Disputed the prepared prediction evaluation.",
      sourceIds: prediction.sourceIds,
      payload: {
        checkId: prediction.id,
        attemptEventId: attemptEvent.id,
        reason: "The evaluation overlooked the mechanism in the second sentence.",
        correction: "Treat the consequence and mechanism as separate supported claims."
      }
    };
    const afterDispute = deriveUnderstandingChecks([registration(prediction), attemptEvent, dispute], context);

    expect(afterDispute.reviewItems).toHaveLength(0);
    expect(afterDispute.evidenceVectors).toHaveLength(0);
    expect(afterDispute.checks[0]?.attempts[0]?.dispute?.evidenceEventId).toBe(dispute.id);
  });

  it("rejects repeated prompts, cue variants, and attempts after learner rejection", () => {
    const { checks, context } = fixture();
    const recall = checks[0];
    const duplicate = { ...checks[1], prompt: recall.prompt };
    expect(() => deriveUnderstandingChecks([registration(recall), registration(duplicate)], context)).toThrow(
      "prompt is duplicated"
    );

    const preference: EvidenceEvent = {
      id: "evt-reject-recall",
      type: "learning.understanding_check_preference_recorded",
      kind: "user_interpretation",
      createdAt: "2026-07-19T13:04:00.000Z",
      actor: "human",
      summary: "Rejected future checks in this form.",
      sourceIds: recall.sourceIds,
      payload: { checkId: recall.id, preference: "reject", reason: "Use a different activity." }
    };
    expect(() =>
      deriveUnderstandingChecks(
        [registration(recall), preference, attempt(recall, supportedEvaluation(recall))],
        context
      )
    ).toThrow("rejected check");
  });
});
