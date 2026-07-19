import { AlertCircle, Minus, Plus, X } from "lucide-react";
import { useState } from "react";
import { EXPLAINER_LIMITS, type ExplainerFeedback, type ExplainerProjection } from "../../domain/explainer";
import { EvidenceInspector } from "./EvidenceInspector";
import { ExplainerSection } from "./ExplainerSection";
import type { FragmentIndex, RecordExplainerFeedback, SourceIndex } from "./types";

interface ExplainerPreviewProps {
  artifact: ExplainerProjection;
  fragmentsById: FragmentIndex;
  sourcesById: SourceIndex;
  onFeedback: RecordExplainerFeedback;
}

export function ExplainerPreview({ artifact, fragmentsById, sourcesById, onFeedback }: ExplainerPreviewProps) {
  const firstFragmentId = artifact.sections.flatMap((section) => section.fragmentIds)[0];
  const [selectedFragmentId, setSelectedFragmentId] = useState(firstFragmentId);
  const [correctionSectionId, setCorrectionSectionId] = useState<string>();
  const [correction, setCorrection] = useState("");
  const [saved, setSaved] = useState<string>();
  const [feedbackPending, setFeedbackPending] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string>();
  const selectedFragment = selectedFragmentId ? fragmentsById.get(selectedFragmentId) : undefined;
  const selectedSource = selectedFragment ? sourcesById.get(selectedFragment.sourceId) : undefined;
  const latestDepth = [...artifact.feedback].reverse().find((feedback) => feedback.kind === "depth");

  async function record(feedback: ExplainerFeedback): Promise<boolean> {
    if (feedbackPending) return false;
    setFeedbackPending(true);
    setFeedbackError(undefined);
    setSaved(undefined);
    try {
      await onFeedback(artifact.id, feedback);
      setSaved(feedback.kind);
      window.setTimeout(() => setSaved(undefined), 1800);
      return true;
    } catch {
      setFeedbackError("Feedback could not be recorded. Nothing was saved; please try again.");
      return false;
    } finally {
      setFeedbackPending(false);
    }
  }

  function openCorrection(sectionId: string) {
    setCorrectionSectionId(sectionId);
    setCorrection("");
    setFeedbackError(undefined);
  }

  function closeCorrection() {
    setCorrectionSectionId(undefined);
    setCorrection("");
  }

  async function submitCorrection() {
    if (
      !correctionSectionId ||
      correction.trim().length < 3 ||
      correction.length > EXPLAINER_LIMITS.correctionCharacters
    )
      return;
    const recorded = await record({ kind: "correction", sectionId: correctionSectionId, correction });
    if (recorded) closeCorrection();
  }

  return (
    <div className="explainer-preview" aria-busy={feedbackPending}>
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
            aria-pressed={latestDepth?.kind === "depth" && latestDepth.depth === "less"}
            disabled={feedbackPending}
            title="Request less depth"
            onClick={() => void record({ kind: "depth", depth: "less" })}
          >
            <Minus size={13} /> Less
          </button>
          <button
            type="button"
            className={latestDepth?.kind === "depth" && latestDepth.depth === "more" ? "active" : ""}
            aria-pressed={latestDepth?.kind === "depth" && latestDepth.depth === "more"}
            disabled={feedbackPending}
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

      {feedbackError && (
        <div className="feedback-error" role="alert">
          <AlertCircle size={15} />
          <span>{feedbackError}</span>
          <button
            type="button"
            className="icon-button"
            title="Dismiss error"
            onClick={() => setFeedbackError(undefined)}
          >
            <X size={14} />
          </button>
        </div>
      )}

      <div className="explainer-reading-grid">
        <div className="explainer-sections">
          {artifact.sections.map((section, index) => (
            <ExplainerSection
              key={section.id}
              section={section}
              index={index}
              fragmentsById={fragmentsById}
              sourcesById={sourcesById}
              feedbackPending={feedbackPending}
              correctionOpen={correctionSectionId === section.id}
              correction={correction}
              onSelectFragment={setSelectedFragmentId}
              onFlagConfusion={() => void record({ kind: "confusion", sectionId: section.id })}
              onOpenCorrection={() => openCorrection(section.id)}
              onCorrectionChange={setCorrection}
              onCancelCorrection={closeCorrection}
              onSubmitCorrection={() => void submitCorrection()}
            />
          ))}
        </div>

        <EvidenceInspector
          fragment={selectedFragment}
          source={selectedSource}
          feedback={artifact.feedback}
          saved={saved}
        />
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
