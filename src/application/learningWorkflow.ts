import { type ExplainerArtifact, type ExplainerFeedback, explainerFeedbackPayloadSchema } from "../domain/explainer";
import type { EvidenceEvent } from "../domain/types";

interface LearningWorkflowDependencies {
  append: (event: EvidenceEvent) => Promise<unknown>;
  resolveExplainer: (artifactId: string) => ExplainerArtifact | undefined;
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

  return { recordExplainerFeedback };
}

export type LearningWorkflow = ReturnType<typeof createLearningWorkflow>;
