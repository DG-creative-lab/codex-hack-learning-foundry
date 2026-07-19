import { BookOpen, Flag, Quote, Send, X } from "lucide-react";
import { EXPLAINER_LIMITS, type ExplainerSection as ExplainerSectionModel } from "../../domain/explainer";
import type { FragmentIndex, SourceIndex } from "./types";

const epistemicLabels = {
  source_fact: "Source claim",
  user_interpretation: "Human interpretation",
  agent_synthesis: "Synthesized interpretation",
  practical_observation: "Practical observation",
  hypothesis: "Assumption to test",
  validated_behavior: "Validated behavior"
} as const;

interface ExplainerSectionProps {
  section: ExplainerSectionModel;
  index: number;
  fragmentsById: FragmentIndex;
  sourcesById: SourceIndex;
  feedbackPending: boolean;
  correctionOpen: boolean;
  correction: string;
  onSelectFragment: (fragmentId: string) => void;
  onFlagConfusion: () => void;
  onOpenCorrection: () => void;
  onCorrectionChange: (value: string) => void;
  onCancelCorrection: () => void;
  onSubmitCorrection: () => void;
}

export function ExplainerSection({
  section,
  index,
  fragmentsById,
  sourcesById,
  feedbackPending,
  correctionOpen,
  correction,
  onSelectFragment,
  onFlagConfusion,
  onOpenCorrection,
  onCorrectionChange,
  onCancelCorrection,
  onSubmitCorrection
}: ExplainerSectionProps) {
  return (
    <article className={`explainer-section epistemic-${section.epistemicKind}`}>
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
              const fragment = fragmentsById.get(fragmentId);
              const source = fragment ? sourcesById.get(fragment.sourceId) : undefined;
              return (
                <button type="button" key={fragmentId} onClick={() => onSelectFragment(fragmentId)}>
                  <Quote size={12} /> {source?.title ?? "Source"} / {fragment?.location.label ?? "Fragment"}
                </button>
              );
            })}
          </fieldset>
        )}
        <div className="section-feedback-actions">
          <button type="button" disabled={feedbackPending} onClick={onFlagConfusion}>
            <Flag size={12} /> Flag confusion
          </button>
          <button type="button" disabled={feedbackPending} onClick={onOpenCorrection}>
            <BookOpen size={12} /> Correct interpretation
          </button>
        </div>
        {correctionOpen && (
          <div className="correction-editor">
            <label htmlFor={`correction-${section.id}`}>Your correction becomes new evidence</label>
            <textarea
              id={`correction-${section.id}`}
              value={correction}
              onChange={(event) => onCorrectionChange(event.target.value)}
              maxLength={EXPLAINER_LIMITS.correctionCharacters}
              aria-describedby={`correction-limit-${section.id}`}
              placeholder="State what should change and why. The source remains unchanged."
              rows={3}
            />
            <span className="correction-limit" id={`correction-limit-${section.id}`}>
              {correction.length.toLocaleString()} / {EXPLAINER_LIMITS.correctionCharacters.toLocaleString()}
            </span>
            <div>
              <button type="button" className="icon-button" title="Cancel correction" onClick={onCancelCorrection}>
                <X size={14} />
              </button>
              <button
                type="button"
                className="primary-button"
                disabled={
                  feedbackPending ||
                  correction.trim().length < 3 ||
                  correction.length > EXPLAINER_LIMITS.correctionCharacters
                }
                onClick={onSubmitCorrection}
              >
                <Send size={13} /> {feedbackPending ? "Recording..." : "Record correction"}
              </button>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
