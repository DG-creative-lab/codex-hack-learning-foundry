import { AlertCircle, ArrowRight, BookOpen, Check, Flag, Minus, Plus, Quote, Send, X } from "lucide-react";
import { useState } from "react";
import type { ExplainerArtifact, ExplainerFeedback, ExplainerProjection } from "../domain/explainer";
import type { NormalizedSourceFragment } from "../domain/sourcePipeline";
import type { LearningArtifact, SourceRecord } from "../domain/workspaceEntities";

const artifactTypeLabels = {
  lesson: "Lesson",
  exercise: "Exercise",
  review: "Review set",
  reflection: "Reflection"
} as const;

const epistemicLabels = {
  source_fact: "Source claim",
  user_interpretation: "Human interpretation",
  agent_synthesis: "Synthesized interpretation",
  practical_observation: "Practical observation",
  hypothesis: "Assumption to test",
  validated_behavior: "Validated behavior"
} as const;

interface LearnViewProps {
  artifacts: LearningArtifact[];
  explainers: ExplainerProjection[];
  fragments: NormalizedSourceFragment[];
  sources: SourceRecord[];
  onFeedback: (artifact: ExplainerArtifact, feedback: ExplainerFeedback) => Promise<void>;
}

function GenericArtifactPreview({ artifact }: { artifact: LearningArtifact }) {
  return (
    <div className="artifact-preview">
      <div className="preview-meta">
        <span>{artifactTypeLabels[artifact.type]}</span>
        <span>{artifact.evidence}</span>
      </div>
      <p className="eyebrow">Active learning unit</p>
      <h2>{artifact.title}</h2>
      <p className="preview-lede">
        Generated from shared knowledge, then adapted using prior responses, confidence, weak spots, and working style.
      </p>
      <div className="lesson-sequence">
        <div>
          <span>01</span>
          <strong>Retrieve</strong>
          <p>Explain without reopening the source.</p>
        </div>
        <div>
          <span>02</span>
          <strong>Apply</strong>
          <p>Diagnose a new operational interface.</p>
        </div>
        <div>
          <span>03</span>
          <strong>Reflect</strong>
          <p>Record uncertainty and revised understanding.</p>
        </div>
      </div>
      <button type="button" className="primary-button">
        Continue session <ArrowRight size={15} />
      </button>
    </div>
  );
}

interface ExplainerPreviewProps {
  artifact: ExplainerProjection;
  fragments: NormalizedSourceFragment[];
  sources: SourceRecord[];
  onFeedback: LearnViewProps["onFeedback"];
}

function ExplainerPreview({ artifact, fragments, sources, onFeedback }: ExplainerPreviewProps) {
  const firstFragmentId = artifact.sections.flatMap((section) => section.fragmentIds)[0];
  const [selectedFragmentId, setSelectedFragmentId] = useState(firstFragmentId);
  const [correctionSectionId, setCorrectionSectionId] = useState<string>();
  const [correction, setCorrection] = useState("");
  const [saved, setSaved] = useState<string>();
  const selectedFragment = fragments.find((fragment) => fragment.id === selectedFragmentId);
  const selectedSource = sources.find((source) => source.id === selectedFragment?.sourceId);
  const latestDepth = [...artifact.feedback].reverse().find((feedback) => feedback.kind === "depth");
  const confusionCount = artifact.feedback.filter((feedback) => feedback.kind === "confusion").length;
  const correctionCount = artifact.feedback.filter((feedback) => feedback.kind === "correction").length;

  async function record(feedback: ExplainerFeedback) {
    await onFeedback(artifact, feedback);
    setSaved(feedback.kind);
    window.setTimeout(() => setSaved(undefined), 1800);
  }

  async function submitCorrection() {
    if (!correctionSectionId || correction.trim().length < 3) return;
    await record({ kind: "correction", sectionId: correctionSectionId, correction });
    setCorrection("");
    setCorrectionSectionId(undefined);
  }

  return (
    <div className="explainer-preview">
      <header className="explainer-titlebar">
        <div>
          <p className="eyebrow">Source-grounded explainer</p>
          <h2>{artifact.title}</h2>
          <p>{artifact.objective}</p>
        </div>
        <fieldset className="depth-control">
          <legend>Depth</legend>
          <button
            type="button"
            className={latestDepth?.kind === "depth" && latestDepth.depth === "less" ? "active" : ""}
            title="Request less depth"
            onClick={() => void record({ kind: "depth", depth: "less" })}
          >
            <Minus size={13} /> Less
          </button>
          <button
            type="button"
            className={latestDepth?.kind === "depth" && latestDepth.depth === "more" ? "active" : ""}
            title="Request more depth"
            onClick={() => void record({ kind: "depth", depth: "more" })}
          >
            <Plus size={13} /> More
          </button>
        </fieldset>
      </header>

      <div className="explainer-context">
        <span>Active project</span>
        <p>{artifact.projectContext}</p>
      </div>

      <div className="explainer-reading-grid">
        <div className="explainer-sections">
          {artifact.sections.map((section, index) => (
            <article key={section.id} className={`explainer-section epistemic-${section.epistemicKind}`}>
              <div className="section-number">{String(index + 1).padStart(2, "0")}</div>
              <div>
                <div className="section-kicker">
                  <span>{section.kind}</span>
                  <strong>{epistemicLabels[section.epistemicKind]}</strong>
                </div>
                <h3>{section.title}</h3>
                <p>{section.content}</p>
                {section.fragmentIds.length > 0 && (
                  <fieldset className="fragment-links">
                    <legend>Source evidence</legend>
                    {section.fragmentIds.map((fragmentId) => {
                      const fragment = fragments.find((candidate) => candidate.id === fragmentId);
                      const source = sources.find((candidate) => candidate.id === fragment?.sourceId);
                      return (
                        <button type="button" key={fragmentId} onClick={() => setSelectedFragmentId(fragmentId)}>
                          <Quote size={12} /> {source?.title ?? "Source"} / {fragment?.location.label ?? "Fragment"}
                        </button>
                      );
                    })}
                  </fieldset>
                )}
                <div className="section-feedback-actions">
                  <button type="button" onClick={() => void record({ kind: "confusion", sectionId: section.id })}>
                    <Flag size={12} /> Flag confusion
                  </button>
                  <button type="button" onClick={() => setCorrectionSectionId(section.id)}>
                    <BookOpen size={12} /> Correct interpretation
                  </button>
                </div>
                {correctionSectionId === section.id && (
                  <div className="correction-editor">
                    <label htmlFor={`correction-${section.id}`}>Your correction becomes new evidence</label>
                    <textarea
                      id={`correction-${section.id}`}
                      value={correction}
                      onChange={(event) => setCorrection(event.target.value)}
                      placeholder="State what should change and why. The source remains unchanged."
                      rows={3}
                    />
                    <div>
                      <button
                        type="button"
                        className="icon-button"
                        title="Cancel correction"
                        onClick={() => setCorrectionSectionId(undefined)}
                      >
                        <X size={14} />
                      </button>
                      <button
                        type="button"
                        className="primary-button"
                        disabled={correction.trim().length < 3}
                        onClick={() => void submitCorrection()}
                      >
                        <Send size={13} /> Record correction
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>

        <aside className="explainer-inspector">
          <div className="inspector-block">
            <p className="eyebrow">Exact source context</p>
            {selectedFragment ? (
              <>
                <strong>{selectedSource?.title}</strong>
                <span>{selectedFragment.location.label}</span>
                <blockquote>{selectedFragment.content}</blockquote>
                <small>{selectedSource?.provenance}</small>
              </>
            ) : (
              <p>Select a source marker to inspect its fragment.</p>
            )}
          </div>
          <div className="inspector-block feedback-summary">
            <p className="eyebrow">Learner evidence</p>
            <dl>
              <div>
                <dt>Confusion flags</dt>
                <dd>{confusionCount}</dd>
              </div>
              <div>
                <dt>Corrections</dt>
                <dd>{correctionCount}</dd>
              </div>
              <div>
                <dt>Depth request</dt>
                <dd>{latestDepth?.kind === "depth" ? latestDepth.depth : "None"}</dd>
              </div>
            </dl>
            {saved && (
              <p className="feedback-saved">
                <Check size={12} /> Evidence appended
              </p>
            )}
          </div>
        </aside>
      </div>

      <footer className="explainer-seeds">
        <div>
          <span>Understanding checks</span>
          <strong>{artifact.understandingCheckSeeds.length} prompts ready</strong>
          <p>{artifact.understandingCheckSeeds[0]?.prompt}</p>
        </div>
        <div>
          <span>Micro-world seed</span>
          <strong>{artifact.microWorldSeed.title}</strong>
          <p>{artifact.microWorldSeed.scenario}</p>
        </div>
      </footer>
    </div>
  );
}

export function LearnView({ artifacts, explainers, fragments, sources, onFeedback }: LearnViewProps) {
  const firstItemId = explainers[0]
    ? `explainer:${explainers[0].id}`
    : artifacts[0]
      ? `artifact:${artifacts[0].id}`
      : "";
  const [selectedItemId, setSelectedItemId] = useState(firstItemId);
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
            artifact={selectedExplainer}
            fragments={fragments}
            sources={sources}
            onFeedback={onFeedback}
          />
        ) : selectedArtifact ? (
          <GenericArtifactPreview artifact={selectedArtifact} />
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
