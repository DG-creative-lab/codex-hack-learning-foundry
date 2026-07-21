import type { WorkspaceProjection } from "../../domain/workspaceProjection";
import type { PreparedDemoDefinition } from "./demoJourney";

function preparedApplication(workspace: WorkspaceProjection, definition: PreparedDemoDefinition) {
  const { capabilityId, capabilityVersion, revisionTheoryElementId } = definition.artifacts;
  return workspace.practicalEvidence.applications.find(
    (application) =>
      application.capabilityId === capabilityId &&
      application.capabilityVersion === capabilityVersion &&
      application.theoryElementIds.includes(revisionTheoryElementId) &&
      application.execution.requestedAdapter === "prepared" &&
      application.execution.completedAdapter === "prepared" &&
      application.execution.fallbackUsed === false &&
      application.execution.attempts.length === 1 &&
      application.execution.attempts[0]?.adapterVersion === definition.artifacts.preparedAdapterVersion
  );
}

export const designDensityPreparedDemo: PreparedDemoDefinition = {
  id: "design-density-cognitive-continuity",
  artifacts: {
    sourceId: "source-dense-by-design",
    theoryElementId: "theory-purpose-review-value",
    explainerId: "explainer-value-density",
    microWorldId: "micro-world-density-queue",
    microWorldPredictionOptionId: "prediction-tradeoff",
    transferCheckId: "check-theory-design-density-transfer-c1",
    capabilityId: "value-density-reviewer",
    capabilityVersion: "0.1.0",
    preparedAdapterVersion: "prepared-v1",
    revisionTheoryElementId: "theory-concept-value-density"
  },
  completion: {
    source: (workspace, visited, definition) =>
      visited.has("source") && workspace.sources.some((source) => source.id === definition.artifacts.sourceId),
    theory: (workspace, visited, definition) =>
      visited.has("theory") &&
      workspace.theory.elements.some(
        (element) => element.id === definition.artifacts.theoryElementId && element.status !== "superseded"
      ),
    explainer: (workspace, visited, definition) =>
      visited.has("explainer") &&
      workspace.explainers.some((explainer) => explainer.id === definition.artifacts.explainerId),
    experiment: (workspace, _visited, definition) => {
      const { microWorldId, microWorldPredictionOptionId } = definition.artifacts;
      const world = workspace.microWorlds.find((artifact) => artifact.id === microWorldId);
      if (!world) return false;
      return world.interactions.some((interaction) => {
        const prediction = world.predictions.find(
          (candidate) =>
            candidate.evidenceEventId === interaction.predictionEventId &&
            candidate.artifactId === microWorldId &&
            candidate.optionId === microWorldPredictionOptionId
        );
        return (
          Boolean(prediction) &&
          interaction.artifactId === microWorldId &&
          world.reflections.some(
            (reflection) =>
              reflection.artifactId === microWorldId && reflection.interactionEventId === interaction.evidenceEventId
          )
        );
      });
    },
    transfer: (workspace, _visited, definition) => {
      const check = workspace.understandingChecks.find(
        (candidate) => candidate.id === definition.artifacts.transferCheckId
      );
      return check?.kind === "transfer" && check.attempts.length > 0;
    },
    capability: (workspace, _visited, definition) => {
      const capability = workspace.capabilities.find(
        (candidate) =>
          candidate.manifest.id === definition.artifacts.capabilityId &&
          candidate.manifest.version === definition.artifacts.capabilityVersion
      );
      return Boolean(
        capability?.activation &&
          capability.decision?.payload.decision === "approved" &&
          capability.activation.payload.approvalEventId === capability.decision.evidenceEventId
      );
    },
    application: (workspace, _visited, definition) => Boolean(preparedApplication(workspace, definition)),
    revision: (workspace, _visited, definition) => {
      const application = preparedApplication(workspace, definition);
      if (!application) return false;
      const { capabilityId, capabilityVersion, revisionTheoryElementId } = definition.artifacts;
      const correction = workspace.practicalEvidence.feedback.find(
        (feedback) =>
          feedback.kind === "correction" &&
          feedback.subjectEventId === application.evidenceEventId &&
          feedback.capabilityId === capabilityId &&
          feedback.theoryElementIds.includes(revisionTheoryElementId)
      );
      if (!correction) return false;
      return workspace.consolidationProposals.some(
        (proposal) =>
          proposal.status === "approved" &&
          proposal.triggerEventIds.includes(correction.evidenceEventId) &&
          proposal.reviewItems.some((item) => item.theoryElementIds.includes(revisionTheoryElementId)) &&
          proposal.theoryRevisions.some(
            (revision) =>
              revision.revisesElementId === revisionTheoryElementId &&
              revision.evidenceEventIds.includes(correction.evidenceEventId)
          ) &&
          proposal.capabilityRevisionRequests.some(
            (request) =>
              request.capabilityId === capabilityId &&
              request.capabilityVersion === capabilityVersion &&
              request.theoryElementIds.includes(revisionTheoryElementId) &&
              request.evidenceEventIds.includes(correction.evidenceEventId)
          )
      );
    }
  }
};
