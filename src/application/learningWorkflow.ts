import { type ExplainerArtifact, type ExplainerFeedback, explainerFeedbackPayloadSchema } from "../domain/explainer";
import type { EvidenceEvent } from "../domain/types";
import { createProvisionalEvaluation } from "../domain/understandingCheckGeneration";
import {
  type CheckPreference,
  checkPreferencePayloadSchema,
  type EvaluationDispute,
  evaluationDisputePayloadSchema,
  type UnderstandingCheckProjection,
  type UnderstandingEvaluation,
  type UnderstandingResponse,
  understandingAttemptPayloadSchema,
  understandingResponseSchema
} from "../domain/understandingChecks";

interface LearningWorkflowDependencies {
  append: (event: EvidenceEvent) => Promise<unknown>;
  resolveExplainer: (artifactId: string) => ExplainerArtifact | undefined;
  resolveUnderstandingCheck: (checkId: string) => UnderstandingCheckProjection | undefined;
  evaluateUnderstandingResponse?: (
    check: UnderstandingCheckProjection,
    response: UnderstandingResponse
  ) => UnderstandingEvaluation;
  now?: () => string;
  createId?: (prefix: string) => string;
}

function defaultId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function feedbackSummary(artifact: ExplainerArtifact, feedback: ExplainerFeedback): string {
  if (feedback.kind === "confusion") return `Flagged confusion in ${artifact.title}.`;
  if (feedback.kind === "correction") return `Corrected an interpretation in ${artifact.title}.`;
  return `Requested ${feedback.depth} depth for ${artifact.title}.`;
}

export function createLearningWorkflow(dependencies: LearningWorkflowDependencies) {
  const now = dependencies.now ?? (() => new Date().toISOString());
  const createId = dependencies.createId ?? defaultId;
  const evaluateUnderstandingResponse = dependencies.evaluateUnderstandingResponse ?? createProvisionalEvaluation;

  async function recordExplainerFeedback(artifactIdInput: string, feedbackInput: ExplainerFeedback) {
    const { artifactId, feedback } = explainerFeedbackPayloadSchema.parse({
      artifactId: artifactIdInput,
      feedback: feedbackInput
    });
    const artifact = dependencies.resolveExplainer(artifactId);
    if (!artifact) throw new Error(`Cannot record feedback for unknown explainer ${artifactId}`);
    if ("sectionId" in feedback && !artifact.sections.some((section) => section.id === feedback.sectionId)) {
      throw new Error(`Explainer feedback references unknown section ${feedback.sectionId}`);
    }
    const event: EvidenceEvent = {
      id: createId("evt-learning-feedback"),
      type: "learning.explainer_feedback_recorded",
      kind: "user_interpretation",
      createdAt: now(),
      actor: "human",
      summary: feedbackSummary(artifact, feedback),
      sourceIds: artifact.sourceIds,
      payload: { artifactId, feedback }
    };
    await dependencies.append(event);
  }

  async function recordUnderstandingResponse(checkIdInput: string, responseInput: UnderstandingResponse) {
    const response = understandingResponseSchema.parse(responseInput);
    const check = dependencies.resolveUnderstandingCheck(checkIdInput);
    if (!check) throw new Error(`Cannot record a response for unknown check ${checkIdInput}`);
    if (check.status === "rejected") throw new Error(`Cannot record a response for rejected check ${check.id}`);
    const evaluation = evaluateUnderstandingResponse(check, response);
    const payload = understandingAttemptPayloadSchema.parse({ checkId: check.id, response, evaluation });
    const checkTheoryElementIds = new Set(check.theoryElementIds);
    const unknownSignalTheoryId = evaluation.signals
      .flatMap((signal) => signal.theoryElementIds)
      .find((theoryElementId) => !checkTheoryElementIds.has(theoryElementId));
    if (unknownSignalTheoryId) {
      throw new Error(`Understanding evaluation references undeclared theory element ${unknownSignalTheoryId}`);
    }
    const reviewSourceIds = [...new Set(evaluation.reviewItems.flatMap((item) => item.sourceIds))];
    const unknownReviewSourceId = reviewSourceIds.find((sourceId) => !check.sourceIds.includes(sourceId));
    if (unknownReviewSourceId) {
      throw new Error(`Understanding evaluation review item references undeclared source ${unknownReviewSourceId}`);
    }
    const event: EvidenceEvent = {
      id: createId("evt-understanding-attempt"),
      type: "learning.understanding_attempt_recorded",
      kind: "practical_observation",
      createdAt: now(),
      actor: "human",
      summary: `Recorded a ${check.kind.replace("_", " ")} response for ${check.projectContext}.`,
      sourceIds: [...new Set([...check.sourceIds, ...response.sourceSupport.sourceIds, ...reviewSourceIds])],
      payload
    };
    await dependencies.append(event);
  }

  async function disputeUnderstandingEvaluation(checkId: string, disputeInput: Omit<EvaluationDispute, "checkId">) {
    const check = dependencies.resolveUnderstandingCheck(checkId);
    if (!check) throw new Error(`Cannot dispute an evaluation for unknown check ${checkId}`);
    const dispute = evaluationDisputePayloadSchema.parse({ checkId, ...disputeInput });
    const attempt = check.attempts.find((item) => item.eventId === dispute.attemptEventId);
    if (!attempt) throw new Error(`Cannot dispute unknown attempt ${dispute.attemptEventId}`);
    if (attempt.dispute) throw new Error(`Attempt ${attempt.eventId} is already disputed`);
    const event: EvidenceEvent = {
      id: createId("evt-understanding-dispute"),
      type: "learning.understanding_evaluation_disputed",
      kind: "user_interpretation",
      createdAt: now(),
      actor: "human",
      summary: `Disputed an evaluation for the ${check.kind.replace("_", " ")} check.`,
      sourceIds: check.sourceIds,
      payload: dispute
    };
    await dependencies.append(event);
  }

  async function recordCheckPreference(checkId: string, preferenceInput: Omit<CheckPreference, "checkId">) {
    const check = dependencies.resolveUnderstandingCheck(checkId);
    if (!check) throw new Error(`Cannot steer unknown check ${checkId}`);
    if (check.status === "rejected") throw new Error(`Check ${check.id} has already been rejected`);
    const preference = checkPreferencePayloadSchema.parse({ checkId, ...preferenceInput });
    const event: EvidenceEvent = {
      id: createId("evt-understanding-preference"),
      type: "learning.understanding_check_preference_recorded",
      kind: "user_interpretation",
      createdAt: now(),
      actor: "human",
      summary: `Recorded a future-check preference for ${check.kind.replace("_", " ")}.`,
      sourceIds: check.sourceIds,
      payload: preference
    };
    await dependencies.append(event);
  }

  return {
    recordExplainerFeedback,
    recordUnderstandingResponse,
    disputeUnderstandingEvaluation,
    recordCheckPreference
  };
}

export type LearningWorkflow = ReturnType<typeof createLearningWorkflow>;
