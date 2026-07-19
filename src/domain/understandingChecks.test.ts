import { describe, expect, it } from "vitest";
import { seedEvents } from "../data/sample";
import type { EvidenceEvent } from "./types";
import { createProvisionalEvaluation, generateUnderstandingChecks } from "./understandingCheckGeneration";
import {
  countUnderstandingFeedbackEvents,
  deriveUnderstandingChecks,
  summarizeEvidenceForTheoryElements
} from "./understandingCheckProjection";
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

  it("requires semantic purpose and boundary elements rather than substituting arbitrary active elements", () => {
    const { workspace } = fixture();
    const withoutPurpose = {
      ...workspace.theory,
      elements: workspace.theory.elements.filter((element) => element.kind !== "purpose")
    };
    const withoutBoundary = {
      ...workspace.theory,
      elements: workspace.theory.elements.filter((element) => element.kind !== "boundary")
    };

    expect(() => generateUnderstandingChecks({ theory: withoutPurpose, activeProject })).toThrow("active purpose");
    expect(() => generateUnderstandingChecks({ theory: withoutBoundary, activeProject })).toThrow("active boundary");
  });

  it("keeps prompts and cue variants unique beyond the initial framing rotation", () => {
    const { workspace, context } = fixture();
    const cycles = Array.from({ length: 6 }, (_, index) =>
      generateUnderstandingChecks({ theory: workspace.theory, activeProject, cycle: index + 1 })
    );
    const generated = cycles.flat();

    expect(new Set(generated.map((check) => check.prompt)).size).toBe(generated.length);
    expect(new Set(generated.map((check) => `${check.cue.family}:${check.cue.variant}`)).size).toBe(generated.length);
    expect(() => deriveUnderstandingChecks(generated.map(registration), context)).not.toThrow();
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
    const vectorsByTheoryId = new Map(beforeDispute.evidenceVectors.map((vector) => [vector.theoryElementId, vector]));
    const summary = summarizeEvidenceForTheoryElements(vectorsByTheoryId.values(), prediction.theoryElementIds);
    expect(summary.prediction.challenges).toBe(1);

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
    const preference: EvidenceEvent = {
      id: "evt-preference-prediction",
      type: "learning.understanding_check_preference_recorded",
      kind: "user_interpretation",
      createdAt: "2026-07-19T13:11:00.000Z",
      actor: "human",
      summary: "Requested a different prediction angle.",
      sourceIds: prediction.sourceIds,
      payload: { checkId: prediction.id, preference: "different_angle" }
    };
    const secondPreference: EvidenceEvent = {
      ...preference,
      id: "evt-preference-prediction-2",
      createdAt: "2026-07-19T13:12:00.000Z",
      summary: "Requested more prediction checks after changing the angle.",
      payload: { checkId: prediction.id, preference: "more_like_this" }
    };
    const afterDispute = deriveUnderstandingChecks(
      [registration(prediction), attemptEvent, dispute, preference, secondPreference],
      context
    );

    expect(afterDispute.reviewItems).toHaveLength(0);
    expect(afterDispute.evidenceVectors).toHaveLength(0);
    expect(afterDispute.checks[0]?.attempts[0]?.dispute?.evidenceEventId).toBe(dispute.id);
    expect(afterDispute.checks[0]?.preferences).toHaveLength(2);
    expect(countUnderstandingFeedbackEvents(afterDispute.checks)).toBe(4);
  });

  it("disputes an older attempt without removing evidence from a later interleaved attempt", () => {
    const { checks, context } = fixture();
    const prediction = checks.find((check) => check.kind === "prediction");
    if (!prediction) throw new Error("Prediction check missing");
    const olderAttempt = attempt(
      prediction,
      createProvisionalEvaluation(prediction, { ...response, answer: "It would get worse." }),
      "evt-attempt-prediction-older"
    );
    const laterEvaluation: UnderstandingEvaluation = {
      outcome: "supported",
      evaluator: "prepared",
      feedback: "The later response predicts the consequence and explains the mechanism.",
      signals: [
        {
          dimension: "prediction",
          signal: "supports",
          rationale: "The response connects the changed condition to a plausible outcome.",
          theoryElementIds: prediction.theoryElementIds
        }
      ],
      reviewItems: []
    };
    const laterAttempt = {
      ...attempt(prediction, laterEvaluation, "evt-attempt-prediction-later"),
      createdAt: "2026-07-19T13:06:00.000Z"
    };
    const dispute: EvidenceEvent = {
      id: "evt-dispute-prediction-older",
      type: "learning.understanding_evaluation_disputed",
      kind: "user_interpretation",
      createdAt: "2026-07-19T13:07:00.000Z",
      actor: "human",
      summary: "Disputed the older prediction evaluation.",
      sourceIds: prediction.sourceIds,
      payload: {
        checkId: prediction.id,
        attemptEventId: olderAttempt.id,
        reason: "The earlier evaluation overlooked a supported causal step.",
        correction: "Treat the causal step as supported while preserving the later attempt as separate evidence."
      }
    };

    const projection = deriveUnderstandingChecks(
      [registration(prediction), olderAttempt, laterAttempt, dispute],
      context
    );
    const projectedCheck = projection.checks[0];
    const summary = summarizeEvidenceForTheoryElements(projection.evidenceVectors, prediction.theoryElementIds);

    expect(projectedCheck?.attempts).toHaveLength(2);
    expect(projectedCheck?.attempts[0]?.dispute?.evidenceEventId).toBe(dispute.id);
    expect(projectedCheck?.attempts[1]?.dispute).toBeUndefined();
    expect(projection.reviewItems).toHaveLength(0);
    expect(summary.prediction).toMatchObject({ supports: 1, challenges: 0 });
  });

  it("requires review provenance in both the check manifest and attempt envelope", () => {
    const { workspace, checks, context } = fixture();
    const prediction = checks.find((check) => check.kind === "prediction");
    if (!prediction) throw new Error("Prediction check missing");
    const externalSourceId = workspace.sources.find((source) => !prediction.sourceIds.includes(source.id))?.id;
    if (!externalSourceId) throw new Error("External source fixture missing");
    const evaluation = createProvisionalEvaluation(prediction, { ...response, answer: "Too short." });
    const reviewItem = evaluation.reviewItems[0];
    if (!reviewItem) throw new Error("Review item fixture missing");
    const undeclaredReviewEvaluation = {
      ...evaluation,
      reviewItems: [{ ...reviewItem, sourceIds: [externalSourceId] }]
    };
    const undeclaredReviewAttempt = {
      ...attempt(prediction, undeclaredReviewEvaluation),
      sourceIds: [...prediction.sourceIds, externalSourceId]
    };
    expect(() => deriveUnderstandingChecks([registration(prediction), undeclaredReviewAttempt], context)).toThrow(
      "unknown check source"
    );

    const expandedCheck = { ...prediction, sourceIds: [...prediction.sourceIds, externalSourceId] };
    const missingEnvelopeAttempt = {
      ...attempt(expandedCheck, undeclaredReviewEvaluation),
      sourceIds: prediction.sourceIds
    };
    expect(() => deriveUnderstandingChecks([registration(expandedCheck), missingEnvelopeAttempt], context)).toThrow(
      "missing provenance"
    );
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
