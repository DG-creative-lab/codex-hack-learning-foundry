import { Send } from "lucide-react";
import {
  type ResponseConfidence,
  type SourceSupportLevel,
  UNDERSTANDING_CHECK_LIMITS,
  type UnderstandingCheckProjection
} from "../../domain/understandingChecks";
import type { SourceIndex } from "./types";

interface UnderstandingResponseComposerProps {
  check: UnderstandingCheckProjection;
  sourcesById: SourceIndex;
  answer: string;
  confidence: ResponseConfidence;
  supportLevel: SourceSupportLevel;
  selectedSourceId: string;
  pending: boolean;
  answerValid: boolean;
  onAnswerChange: (value: string) => void;
  onConfidenceChange: (value: ResponseConfidence) => void;
  onSupportLevelChange: (value: SourceSupportLevel) => void;
  onSourceChange: (value: string) => void;
  onSubmit: () => void;
}

export function UnderstandingResponseComposer({
  check,
  sourcesById,
  answer,
  confidence,
  supportLevel,
  selectedSourceId,
  pending,
  answerValid,
  onAnswerChange,
  onConfidenceChange,
  onSupportLevelChange,
  onSourceChange,
  onSubmit
}: UnderstandingResponseComposerProps) {
  return (
    <section className="response-composer">
      <div className="check-section-heading">
        <p className="eyebrow">{check.attempts.length > 0 ? "Respond again" : "Your response"}</p>
        <span>
          {answer.length.toLocaleString()} / {UNDERSTANDING_CHECK_LIMITS.answerCharacters.toLocaleString()}
        </span>
      </div>
      <textarea
        aria-label="Understanding check response"
        placeholder="Make the reasoning visible. Name the mechanism, consequence, or decision you are using."
        value={answer}
        maxLength={UNDERSTANDING_CHECK_LIMITS.answerCharacters}
        disabled={check.status === "rejected"}
        onChange={(event) => onAnswerChange(event.target.value)}
        rows={7}
      />
      <div className="response-controls">
        <fieldset>
          <legend>Confidence</legend>
          {(["low", "medium", "high"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={confidence === value}
              className={confidence === value ? "active" : ""}
              onClick={() => onConfidenceChange(value)}
            >
              {value}
            </button>
          ))}
        </fieldset>
        <fieldset>
          <legend>Source support</legend>
          {(["none", "reasoned", "cited"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={supportLevel === value}
              className={supportLevel === value ? "active" : ""}
              onClick={() => onSupportLevelChange(value)}
            >
              {value}
            </button>
          ))}
        </fieldset>
      </div>
      {supportLevel === "cited" && (
        <label className="source-select">
          Source
          <select value={selectedSourceId} onChange={(event) => onSourceChange(event.target.value)}>
            {check.sourceIds.map((sourceId) => (
              <option key={sourceId} value={sourceId}>
                {sourcesById.get(sourceId)?.title ?? sourceId}
              </option>
            ))}
          </select>
        </label>
      )}
      <button
        type="button"
        className="primary-button response-submit"
        disabled={!answerValid || pending || check.status === "rejected"}
        onClick={onSubmit}
      >
        <Send size={14} /> {pending ? "Recording..." : "Record response"}
      </button>
    </section>
  );
}
