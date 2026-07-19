import { type ExplainerArtifact, type ExplainerFeedback, explainerFeedbackPayloadSchema } from "../domain/explainer";
import {
  evaluateMicroWorld,
  type MicroWorldProjection,
  type MicroWorldVariableValues,
  microWorldInteractionPayloadSchema,
  microWorldPredictionPayloadSchema,
  microWorldReflectionPayloadSchema
} from "../domain/microWorld";
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
  resolveMicroWorld: (artifactId: string) => MicroWorldProjection | undefined;
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

  async function recordMicroWorldPrediction(
    artifactId: string,
    optionId: string,
    variableValues: MicroWorldVariableValues
  ) {
    const artifact = dependencies.resolveMicroWorld(artifactId);
    if (!artifact) throw new Error(`Cannot predict in unknown micro-world ${artifactId}`);
    if (!artifact.prediction.options.some((option) => option.id === optionId)) {
      throw new Error(`Micro-world prediction references unknown option ${optionId}`);
    }
    evaluateMicroWorld(artifact, variableValues);
    const payload = microWorldPredictionPayloadSchema.parse({ artifactId, optionId, variableValues });
    const event: EvidenceEvent = {
      id: createId("evt-micro-world-prediction"),
      type: "learning.micro_world_prediction_recorded",
      kind: "hypothesis",
      createdAt: now(),
      actor: "human",
      summary: `Predicted an outcome in ${artifact.title}.`,
      sourceIds: artifact.sourceIds,
      payload
    };
    await dependencies.append(event);
  }

  async function recordMicroWorldInteraction(artifactId: string, variableValues: MicroWorldVariableValues) {
    const artifact = dependencies.resolveMicroWorld(artifactId);
    if (!artifact) throw new Error(`Cannot interact with unknown micro-world ${artifactId}`);
    if (artifact.predictions.length === 0) {
      throw new Error(`Micro-world ${artifact.id} requires a prediction before recording an interaction`);
    }
    const previousValues =
      artifact.interactions.at(-1)?.variableValues ??
      Object.fromEntries(artifact.variables.map((variable) => [variable.id, variable.initialValue]));
    const changedVariableIds = artifact.variables
      .filter((variable) => previousValues[variable.id] !== variableValues[variable.id])
      .map((variable) => variable.id);
    if (changedVariableIds.length === 0) throw new Error(`Micro-world interaction records no changed variables`);
    const outcomeValues = evaluateMicroWorld(artifact, variableValues);
    const payload = microWorldInteractionPayloadSchema.parse({
      artifactId,
      variableValues,
      changedVariableIds,
      outcomeValues
    });
    const event: EvidenceEvent = {
      id: createId("evt-micro-world-interaction"),
      type: "learning.micro_world_interaction_recorded",
      kind: "practical_observation",
      createdAt: now(),
      actor: "human",
      summary: `Recorded a changed configuration in ${artifact.title}.`,
      sourceIds: artifact.sourceIds,
      payload
    };
    await dependencies.append(event);
  }

  async function recordMicroWorldReflection(artifactId: string, prompt: string, response: string) {
    const artifact = dependencies.resolveMicroWorld(artifactId);
    if (!artifact) throw new Error(`Cannot reflect on unknown micro-world ${artifactId}`);
    if (artifact.interactions.length === 0) {
      throw new Error(`Micro-world ${artifact.id} requires an interaction before recording a reflection`);
    }
    const interaction = artifact.interactions.at(-1);
    if (!interaction) throw new Error(`Micro-world ${artifact.id} has no interaction to reflect on`);
    if (!artifact.reflectionPrompts.includes(prompt)) throw new Error(`Micro-world reflection uses an unknown prompt`);
    const payload = microWorldReflectionPayloadSchema.parse({
      artifactId,
      prompt,
      response,
      interactionEventId: interaction.evidenceEventId
    });
    const event: EvidenceEvent = {
      id: createId("evt-micro-world-reflection"),
      type: "learning.micro_world_reflection_recorded",
      kind: "user_interpretation",
      createdAt: now(),
      actor: "human",
      summary: `Reflected on an observed trade-off in ${artifact.title}.`,
      sourceIds: artifact.sourceIds,
      payload
    };
    await dependencies.append(event);
  }

  return {
    recordExplainerFeedback,
    recordUnderstandingResponse,
    disputeUnderstandingEvaluation,
    recordCheckPreference,
    recordMicroWorldPrediction,
    recordMicroWorldInteraction,
    recordMicroWorldReflection
  };
}

export type LearningWorkflow = ReturnType<typeof createLearningWorkflow>;
