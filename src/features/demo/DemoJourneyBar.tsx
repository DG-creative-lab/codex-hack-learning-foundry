import { ArrowRight, Check, RotateCcw, X } from "lucide-react";
import { useState } from "react";
import type { DemoJourneyProjection, DemoJourneyStage } from "./demoJourney";
import "./demoJourney.css";

interface DemoJourneyBarProps {
  journey: DemoJourneyProjection;
  onOpenStage: (stage: DemoJourneyStage) => void;
  onReset: () => Promise<void>;
}

export function DemoJourneyBar({ journey, onOpenStage, onReset }: DemoJourneyBarProps) {
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string>();

  async function resetJourney() {
    setResetting(true);
    setError(undefined);
    try {
      await onReset();
      setConfirmingReset(false);
    } catch {
      setError("The prepared journey could not be restarted. Existing evidence was preserved.");
    } finally {
      setResetting(false);
    }
  }

  return (
    <section className="demo-journey" aria-label="Prepared demo journey">
      <div className="demo-journey-current" aria-live="polite">
        <p className="eyebrow">
          Prepared journey / {String(journey.completedCount).padStart(2, "0")} of {journey.stages.length}
        </p>
        <strong>{journey.current.title}</strong>
        <span>{journey.current.why}</span>
      </div>

      <ol className="demo-stage-register">
        {journey.stages.map((stage, index) => (
          <li key={stage.id} data-state={stage.state}>
            <button
              type="button"
              aria-current={stage.state === "current" ? "step" : undefined}
              aria-label={`${index + 1}. ${stage.shortLabel}: ${stage.state}`}
              onClick={() => onOpenStage(stage)}
            >
              <span>{stage.state === "complete" ? <Check size={11} aria-hidden="true" /> : index + 1}</span>
              <span>{stage.shortLabel}</span>
            </button>
          </li>
        ))}
      </ol>

      <div className="demo-journey-actions">
        {confirmingReset ? (
          <fieldset className="demo-reset-confirm" aria-label="Confirm journey restart">
            <span>Clear recorded demo evidence?</span>
            <button
              type="button"
              className="icon-button"
              title="Cancel restart"
              onClick={() => setConfirmingReset(false)}
            >
              <X size={14} />
            </button>
            <button type="button" className="secondary-button" disabled={resetting} onClick={() => void resetJourney()}>
              <RotateCcw size={14} /> {resetting ? "Restarting..." : "Restart"}
            </button>
          </fieldset>
        ) : (
          <button
            type="button"
            className="icon-button"
            title="Restart prepared journey"
            onClick={() => setConfirmingReset(true)}
          >
            <RotateCcw size={15} />
          </button>
        )}
        <button type="button" className="demo-open-step" onClick={() => onOpenStage(journey.current)}>
          Open step <ArrowRight size={15} />
        </button>
        {error && <p role="alert">{error}</p>}
      </div>
    </section>
  );
}
