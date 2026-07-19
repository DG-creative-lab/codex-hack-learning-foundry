import {
  type ExplainerArtifact,
  type ExplainerFeedback,
  explainerArtifactSchema,
  explainerFeedbackSchema
} from "../domain/explainer";
import type { EvidenceEvent } from "../domain/types";

interface LearningWorkflowDependencies {
  append: (event: EvidenceEvent) => Promise<unknown>;
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

  async function recordExplainerFeedback(artifactInput: ExplainerArtifact, feedbackInput: ExplainerFeedback) {
    const { feedback: _projectedFeedback, ...canonicalArtifact } = artifactInput as ExplainerArtifact & {
      feedback?: unknown;
    };
    const artifact = explainerArtifactSchema.parse(canonicalArtifact);
    const feedback = explainerFeedbackSchema.parse(feedbackInput);
    const event: EvidenceEvent = {
      id: createId("evt-learning-feedback"),
      type: "learning.explainer_feedback_recorded",
      kind: "user_interpretation",
      createdAt: now(),
      actor: "human",
      summary: feedbackSummary(artifact, feedback),
      sourceIds: artifact.sourceIds,
      payload: { artifactId: artifact.id, feedback }
    };
    await dependencies.append(event);
  }

  return { recordExplainerFeedback };
}

export type LearningWorkflow = ReturnType<typeof createLearningWorkflow>;
