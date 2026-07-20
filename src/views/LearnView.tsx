import { AlertCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { UnderstandingContextBar } from "../components/UnderstandingContextBar";
import type { ExplainerProjection } from "../domain/explainer";
import { countMicroWorldEvidence, type MicroWorldProjection } from "../domain/microWorld";
import type { NormalizedSourceFragment } from "../domain/sourcePipeline";
import { countUnderstandingFeedbackEvents } from "../domain/understandingCheckProjection";
import type {
  ProjectedReviewItem,
  UnderstandingCheckProjection,
  UnderstandingEvidenceVector
} from "../domain/understandingChecks";
import type { LearningArtifact, SourceRecord } from "../domain/workspaceEntities";
import { ExplainerPreview } from "../features/learning/ExplainerPreview";
import { artifactTypeLabels, LearningArtifactPreview } from "../features/learning/LearningArtifactPreview";
import { MicroWorldPreview } from "../features/learning/MicroWorldPreview";
import type {
  DisputeUnderstandingEvaluation,
  RecordCheckPreference,
  RecordExplainerFeedback,
  RecordMicroWorldInteraction,
  RecordMicroWorldPrediction,
  RecordMicroWorldReflection,
  RecordUnderstandingResponse
} from "../features/learning/types";
import { UnderstandingCheckPreview } from "../features/learning/UnderstandingCheckPreview";
import "../features/learning/learning.css";

const checkTypeLabels = {
  recall: "Recall",
  explanation: "Explanation",
  prediction: "Prediction",
  teach_back: "Teach-back",
  transfer: "Transfer"
} as const;

interface LearnViewProps {
  requestedItemId?: string;
  onReturnToTheory?: () => void;
  contextTitle?: string;
  artifacts: LearningArtifact[];
  explainers: ExplainerProjection[];
  microWorlds: MicroWorldProjection[];
  checks: UnderstandingCheckProjection[];
  evidenceVectors: UnderstandingEvidenceVector[];
  reviewItems: ProjectedReviewItem[];
  fragments: NormalizedSourceFragment[];
  sources: SourceRecord[];
  onFeedback: RecordExplainerFeedback;
  onResponse: RecordUnderstandingResponse;
  onDispute: DisputeUnderstandingEvaluation;
  onPreference: RecordCheckPreference;
  onMicroWorldPrediction: RecordMicroWorldPrediction;
  onMicroWorldInteraction: RecordMicroWorldInteraction;
  onMicroWorldReflection: RecordMicroWorldReflection;
}

export function LearnView({
  requestedItemId,
  onReturnToTheory,
  contextTitle,
  artifacts,
  explainers,
  microWorlds,
  checks,
  evidenceVectors,
  reviewItems,
  fragments,
  sources,
  onFeedback,
  onResponse,
  onDispute,
  onPreference,
  onMicroWorldPrediction,
  onMicroWorldInteraction,
  onMicroWorldReflection
}: LearnViewProps) {
  const firstItemId = explainers[0]
    ? `explainer:${explainers[0].id}`
    : checks[0]
      ? `check:${checks[0].id}`
      : microWorlds[0]
        ? `micro-world:${microWorlds[0].id}`
        : artifacts[0]
          ? `artifact:${artifacts[0].id}`
          : "";
  const availableItemIds = new Set([
    ...explainers.map((item) => `explainer:${item.id}`),
    ...checks.map((item) => `check:${item.id}`),
    ...microWorlds.map((item) => `micro-world:${item.id}`),
    ...artifacts.map((item) => `artifact:${item.id}`)
  ]);
  const [selectedItemId, setSelectedItemId] = useState(
    requestedItemId && availableItemIds.has(requestedItemId) ? requestedItemId : firstItemId
  );
  const fragmentsById = useMemo(() => new Map(fragments.map((fragment) => [fragment.id, fragment])), [fragments]);
  const sourcesById = useMemo(() => new Map(sources.map((source) => [source.id, source])), [sources]);
  const vectorsByTheoryId = useMemo(
    () => new Map(evidenceVectors.map((vector) => [vector.theoryElementId, vector])),
    [evidenceVectors]
  );
  const selectedExplainer = explainers.find((item) => `explainer:${item.id}` === selectedItemId);
  const selectedCheck = checks.find((item) => `check:${item.id}` === selectedItemId);
  const selectedMicroWorld = microWorlds.find((item) => `micro-world:${item.id}` === selectedItemId);
  const selectedArtifact = artifacts.find((item) => `artifact:${item.id}` === selectedItemId);
  const nextCheck = checks.find((check) => check.status === "ready" && check.attempts.length === 0);
  const checkJourneyItems = checks.map((item) => ({
    id: `check:${item.id}`,
    type: checkTypeLabels[item.kind],
    title: item.prompt,
    status: item.status === "rejected" ? "Rejected" : item.attempts.length > 0 ? "Observed" : "Ready",
    kind: item.kind
  }));
  const journeyItems = [
    ...explainers.map((item) => ({
      id: `explainer:${item.id}`,
      type: "Explainer",
      title: item.title,
      status: "Ready"
    })),
    ...checkJourneyItems.filter((item) => ["recall", "explanation", "prediction"].includes(item.kind)),
    ...microWorlds.map((item) => ({
      id: `micro-world:${item.id}`,
      type: "Micro-world",
      title: item.title,
      status: item.predictions.length === 0 ? "Predict" : item.interactions.length === 0 ? "Explore" : "Observed"
    })),
    ...checkJourneyItems.filter((item) => ["teach_back", "transfer"].includes(item.kind)),
    ...artifacts.map((item) => ({
      id: `artifact:${item.id}`,
      type: artifactTypeLabels[item.type],
      title: item.title,
      status: item.statusLabel
    }))
  ];

  if (journeyItems.length === 0) {
    return (
      <div className="page-scroll learn-view">
        <p className="eyebrow">No learning artifacts have been recorded.</p>
      </div>
    );
  }

  return (
    <div className="page-scroll learn-view">
      {onReturnToTheory && (
        <UnderstandingContextBar contextTitle={contextTitle ?? "Living Theory"} onReturnToTheory={onReturnToTheory} />
      )}
      <section className="learning-header">
        <div>
          <p className="eyebrow">Human learning state</p>
          <h2>Build the model, then transfer it</h2>
          <p>Explain the density lenses, inspect their evidence, and apply them to an unfamiliar interface.</p>
        </div>
        <div className="learning-metrics">
          <p>
            <span>Sources linked</span>
            <strong>{sources.length}</strong>
          </p>
          <p>
            <span>Feedback events</span>
            <strong>
              {explainers.reduce((total, item) => total + item.feedback.length, 0) +
                countUnderstandingFeedbackEvents(checks) +
                countMicroWorldEvidence(microWorlds)}
            </strong>
          </p>
          <p>
            <span>Next</span>
            <strong>{nextCheck ? checkTypeLabels[nextCheck.kind] : "Reflect"}</strong>
          </p>
        </div>
      </section>
      <section
        className={`artifact-workspace ${selectedExplainer ? "explainer-active" : ""} ${selectedCheck ? "check-active" : ""} ${selectedMicroWorld ? "micro-world-active" : ""}`}
      >
        <div className="artifact-list">
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">Generated artifacts</p>
              <h2>Learning path</h2>
            </div>
          </div>
          {journeyItems.map((item, index) => (
            <button
              type="button"
              key={item.id}
              className={selectedItemId === item.id ? "selected" : ""}
              onClick={() => setSelectedItemId(item.id)}
            >
              <span className="artifact-index">{String(index + 1).padStart(2, "0")}</span>
              <span>
                <small>{item.type}</small>
                <strong>{item.title}</strong>
              </span>
              <span>{item.status}</span>
            </button>
          ))}
        </div>
        {selectedExplainer ? (
          <ExplainerPreview
            key={selectedExplainer.id}
            artifact={selectedExplainer}
            fragmentsById={fragmentsById}
            sourcesById={sourcesById}
            onFeedback={onFeedback}
          />
        ) : selectedCheck ? (
          <UnderstandingCheckPreview
            key={selectedCheck.id}
            check={selectedCheck}
            vectorsByTheoryId={vectorsByTheoryId}
            reviewItems={reviewItems.filter((item) => item.checkId === selectedCheck.id)}
            sourcesById={sourcesById}
            onResponse={onResponse}
            onDispute={onDispute}
            onPreference={onPreference}
          />
        ) : selectedMicroWorld ? (
          <MicroWorldPreview
            key={selectedMicroWorld.id}
            artifact={selectedMicroWorld}
            sourcesById={sourcesById}
            onPrediction={onMicroWorldPrediction}
            onInteraction={onMicroWorldInteraction}
            onReflection={onMicroWorldReflection}
          />
        ) : selectedArtifact ? (
          <LearningArtifactPreview artifact={selectedArtifact} />
        ) : (
          <div className="artifact-preview">
            <AlertCircle size={20} />
            <p>This learning artifact is unavailable.</p>
          </div>
        )}
      </section>
    </div>
  );
}
