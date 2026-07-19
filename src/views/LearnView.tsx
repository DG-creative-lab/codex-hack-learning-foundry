import { AlertCircle } from "lucide-react";
import { useMemo, useState } from "react";
import type { ExplainerProjection } from "../domain/explainer";
import type { NormalizedSourceFragment } from "../domain/sourcePipeline";
import type { LearningArtifact, SourceRecord } from "../domain/workspaceEntities";
import { ExplainerPreview } from "../features/learning/ExplainerPreview";
import { artifactTypeLabels, LearningArtifactPreview } from "../features/learning/LearningArtifactPreview";
import type { RecordExplainerFeedback } from "../features/learning/types";

interface LearnViewProps {
  artifacts: LearningArtifact[];
  explainers: ExplainerProjection[];
  fragments: NormalizedSourceFragment[];
  sources: SourceRecord[];
  onFeedback: RecordExplainerFeedback;
}

export function LearnView({ artifacts, explainers, fragments, sources, onFeedback }: LearnViewProps) {
  const firstItemId = explainers[0]
    ? `explainer:${explainers[0].id}`
    : artifacts[0]
      ? `artifact:${artifacts[0].id}`
      : "";
  const [selectedItemId, setSelectedItemId] = useState(firstItemId);
  const fragmentsById = useMemo(() => new Map(fragments.map((fragment) => [fragment.id, fragment])), [fragments]);
  const sourcesById = useMemo(() => new Map(sources.map((source) => [source.id, source])), [sources]);
  const selectedExplainer = explainers.find((item) => `explainer:${item.id}` === selectedItemId);
  const selectedArtifact = artifacts.find((item) => `artifact:${item.id}` === selectedItemId);
  const journeyItems = [
    ...explainers.map((item) => ({
      id: `explainer:${item.id}`,
      type: "Explainer",
      title: item.title,
      status: "Ready"
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
            <strong>{explainers.reduce((total, item) => total + item.feedback.length, 0)}</strong>
          </p>
          <p>
            <span>Next</span>
            <strong>Transfer</strong>
          </p>
        </div>
      </section>
      <section className={`artifact-workspace ${selectedExplainer ? "explainer-active" : ""}`}>
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
