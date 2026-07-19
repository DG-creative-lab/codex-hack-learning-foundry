import { AlertCircle } from "lucide-react";
import { useMemo, useState } from "react";
import type { ExplainerProjection } from "../domain/explainer";
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
import type {
  DisputeUnderstandingEvaluation,
  RecordCheckPreference,
  RecordExplainerFeedback,
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
  artifacts: LearningArtifact[];
  explainers: ExplainerProjection[];
  checks: UnderstandingCheckProjection[];
  evidenceVectors: UnderstandingEvidenceVector[];
  reviewItems: ProjectedReviewItem[];
  fragments: NormalizedSourceFragment[];
  sources: SourceRecord[];
  onFeedback: RecordExplainerFeedback;
  onResponse: RecordUnderstandingResponse;
  onDispute: DisputeUnderstandingEvaluation;
  onPreference: RecordCheckPreference;
}

export function LearnView({
  artifacts,
  explainers,
  checks,
  evidenceVectors,
  reviewItems,
  fragments,
  sources,
  onFeedback,
  onResponse,
  onDispute,
  onPreference
}: LearnViewProps) {
  const firstItemId = explainers[0]
    ? `explainer:${explainers[0].id}`
    : checks[0]
      ? `check:${checks[0].id}`
      : artifacts[0]
        ? `artifact:${artifacts[0].id}`
        : "";
  const [selectedItemId, setSelectedItemId] = useState(firstItemId);
  const fragmentsById = useMemo(() => new Map(fragments.map((fragment) => [fragment.id, fragment])), [fragments]);
  const sourcesById = useMemo(() => new Map(sources.map((source) => [source.id, source])), [sources]);
  const vectorsByTheoryId = useMemo(
    () => new Map(evidenceVectors.map((vector) => [vector.theoryElementId, vector])),
    [evidenceVectors]
  );
  const selectedExplainer = explainers.find((item) => `explainer:${item.id}` === selectedItemId);
  const selectedCheck = checks.find((item) => `check:${item.id}` === selectedItemId);
  const selectedArtifact = artifacts.find((item) => `artifact:${item.id}` === selectedItemId);
  const nextCheck = checks.find((check) => check.status === "ready" && check.attempts.length === 0);
  const journeyItems = [
    ...explainers.map((item) => ({
      id: `explainer:${item.id}`,
      type: "Explainer",
      title: item.title,
      status: "Ready"
    })),
    ...checks.map((item) => ({
      id: `check:${item.id}`,
      type: checkTypeLabels[item.kind],
      title: item.prompt,
      status: item.status === "rejected" ? "Rejected" : item.attempts.length > 0 ? "Observed" : "Ready"
    })),
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
                countUnderstandingFeedbackEvents(checks)}
            </strong>
          </p>
          <p>
            <span>Next</span>
            <strong>{nextCheck ? checkTypeLabels[nextCheck.kind] : "Reflect"}</strong>
          </p>
        </div>
      </section>
      <section
        className={`artifact-workspace ${selectedExplainer ? "explainer-active" : ""} ${selectedCheck ? "check-active" : ""}`}
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
