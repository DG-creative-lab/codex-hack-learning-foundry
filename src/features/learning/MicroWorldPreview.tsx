import { AlertCircle, Check, LockKeyhole, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  evaluateMicroWorld,
  MICRO_WORLD_LIMITS,
  type MicroWorldProjection,
  type MicroWorldVariableValues
} from "../../domain/microWorld";
import { MicroWorldControls } from "./MicroWorldControls";
import { getMicroWorldStage } from "./microWorldStageRegistry";
import type {
  RecordMicroWorldInteraction,
  RecordMicroWorldPrediction,
  RecordMicroWorldReflection,
  SourceIndex
} from "./types";

interface MicroWorldPreviewProps {
  artifact: MicroWorldProjection;
  sourcesById: SourceIndex;
  onPrediction: RecordMicroWorldPrediction;
  onInteraction: RecordMicroWorldInteraction;
  onReflection: RecordMicroWorldReflection;
}

function initialValues(artifact: MicroWorldProjection): MicroWorldVariableValues {
  return (
    artifact.interactions.at(-1)?.variableValues ??
    Object.fromEntries(artifact.variables.map((variable) => [variable.id, variable.initialValue]))
  );
}

function valuesEqual(left: MicroWorldVariableValues, right: MicroWorldVariableValues): boolean {
  return Object.keys(left).every((key) => left[key] === right[key]);
}

function displayValue(value: number, unit: string): string {
  if (unit === "percent") return `${value}%`;
  if (unit === "seconds") return `${value}s`;
  return `${value} ${unit}`;
}

export function MicroWorldPreview({
  artifact,
  sourcesById,
  onPrediction,
  onInteraction,
  onReflection
}: MicroWorldPreviewProps) {
  const canonicalValues = useMemo(() => initialValues(artifact), [artifact]);
  const [values, setValues] = useState<MicroWorldVariableValues>(() => canonicalValues);
  const [committedValues, setCommittedValues] = useState<MicroWorldVariableValues>(() => canonicalValues);
  const [predictionOptionId, setPredictionOptionId] = useState(artifact.prediction.options[0]?.id ?? "");
  const [predictionSaved, setPredictionSaved] = useState(false);
  const [reflectionPrompt, setReflectionPrompt] = useState(artifact.reflectionPrompts[0] ?? "");
  const [reflection, setReflection] = useState("");
  const [pending, setPending] = useState<"prediction" | "interaction" | "reflection">();
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState<string>();
  const outcomeValues = evaluateMicroWorld(artifact, values);
  const outcomesRevealed = artifact.predictions.length > 0 || predictionSaved;
  const hasRecordedInteraction = artifact.interactions.length > 0;
  const configurationChanged = !valuesEqual(values, committedValues);
  const Stage = getMicroWorldStage(artifact.renderer);

  useEffect(() => {
    setCommittedValues(canonicalValues);
  }, [canonicalValues]);

  async function execute(kind: "prediction" | "interaction" | "reflection", action: () => Promise<void>) {
    if (pending) return false;
    setPending(kind);
    setError(undefined);
    setSaved(undefined);
    try {
      await action();
      setSaved(kind);
      window.setTimeout(() => setSaved(undefined), 1800);
      return true;
    } catch {
      setError("This learning evidence could not be recorded. Nothing was saved; please try again.");
      return false;
    } finally {
      setPending(undefined);
    }
  }

  async function submitPrediction() {
    if (!predictionOptionId) return;
    const recorded = await execute("prediction", () => onPrediction(artifact.id, predictionOptionId, values));
    if (recorded) setPredictionSaved(true);
  }

  async function recordConfiguration() {
    if (!outcomesRevealed || !configurationChanged) return;
    const recorded = await execute("interaction", () => onInteraction(artifact.id, values));
    if (recorded) setCommittedValues(values);
  }

  async function submitReflection() {
    if (!reflectionPrompt || reflection.trim().length < 3) return;
    const recorded = await execute("reflection", () => onReflection(artifact.id, reflectionPrompt, reflection));
    if (recorded) setReflection("");
  }

  function resetConfiguration() {
    const resetValues = Object.fromEntries(artifact.variables.map((variable) => [variable.id, variable.initialValue]));
    setValues(resetValues);
  }

  return (
    <div className="micro-world-preview" aria-busy={Boolean(pending)}>
      <header className="micro-world-titlebar">
        <div>
          <p className="eyebrow">Interactive micro-world</p>
          <h2>{artifact.title}</h2>
          <p>{artifact.purpose}</p>
        </div>
        <span>Trusted renderer</span>
      </header>

      <div className="micro-world-context">
        <span>Scenario</span>
        <p>{artifact.scenario}</p>
      </div>

      {error && (
        <div className="feedback-error" role="alert">
          <AlertCircle size={15} />
          <span>{error}</span>
          <button type="button" className="icon-button" title="Dismiss error" onClick={() => setError(undefined)}>
            <X size={14} />
          </button>
        </div>
      )}

      <div className="micro-world-layout">
        <MicroWorldControls
          artifact={artifact}
          values={values}
          outcomesRevealed={outcomesRevealed}
          configurationChanged={configurationChanged}
          pending={Boolean(pending)}
          saved={saved === "interaction"}
          onValueChange={(variableId, value) => setValues((current) => ({ ...current, [variableId]: value }))}
          onReset={resetConfiguration}
          onRecord={() => void recordConfiguration()}
        />

        <Stage artifact={artifact} values={values} />

        <aside className="micro-world-inspector">
          <section className="prediction-panel">
            <p className="eyebrow">Predict before reveal</p>
            <fieldset disabled={outcomesRevealed || Boolean(pending)}>
              <legend>{artifact.prediction.prompt}</legend>
              {artifact.prediction.options.map((option) => (
                <label key={option.id}>
                  <input
                    type="radio"
                    name={`prediction-${artifact.id}`}
                    value={option.id}
                    checked={predictionOptionId === option.id}
                    onChange={() => setPredictionOptionId(option.id)}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </fieldset>
            {!outcomesRevealed && (
              <button
                type="button"
                className="primary-button"
                disabled={!predictionOptionId || Boolean(pending)}
                onClick={() => void submitPrediction()}
              >
                Reveal outcomes
              </button>
            )}
            {outcomesRevealed && (
              <p className="feedback-saved">
                <Check size={13} /> Prediction recorded
              </p>
            )}
          </section>

          <section className="micro-world-outcomes" aria-live="polite">
            <p className="eyebrow">Observable outcomes</p>
            {outcomesRevealed ? (
              artifact.outcomes.map((outcome) => (
                <article key={outcome.id}>
                  <span>{outcome.label}</span>
                  <strong>{displayValue(outcomeValues[outcome.id] ?? 0, outcome.unit)}</strong>
                  <p>{outcome.description}</p>
                </article>
              ))
            ) : (
              <div className="outcome-lock">
                <LockKeyhole size={18} />
                <p>Record a prediction to inspect the modelled consequences.</p>
              </div>
            )}
          </section>
        </aside>
      </div>

      <div className="micro-world-evidence-band">
        <section>
          <p className="eyebrow">Model boundaries</p>
          <h3>Assumptions</h3>
          <ul>
            {artifact.assumptions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <h3>Limitations</h3>
          <ul>
            {artifact.limitations.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
        <section>
          <p className="eyebrow">Theory and sources</p>
          <div className="micro-world-theory-links">
            {artifact.theoryElementIds.map((id) => (
              <span key={id}>{id.replace("theory-", "").replaceAll("-", " ")}</span>
            ))}
          </div>
          <ul className="micro-world-sources">
            {artifact.sourceIds.map((id) => (
              <li key={id}>{sourcesById.get(id)?.title ?? id}</li>
            ))}
          </ul>
        </section>
        <section className="micro-world-reflection">
          <p className="eyebrow">Reflection</p>
          <label>
            <span>Prompt</span>
            <select value={reflectionPrompt} onChange={(event) => setReflectionPrompt(event.target.value)}>
              {artifact.reflectionPrompts.map((prompt) => (
                <option key={prompt}>{prompt}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Your observation</span>
            <textarea
              value={reflection}
              maxLength={MICRO_WORLD_LIMITS.reflectionCharacters}
              disabled={!hasRecordedInteraction}
              onChange={(event) => setReflection(event.target.value)}
              placeholder="Name the trade-off you observed."
            />
          </label>
          <button
            type="button"
            className="primary-button"
            disabled={!hasRecordedInteraction || reflection.trim().length < 3 || Boolean(pending)}
            onClick={() => void submitReflection()}
          >
            Record reflection
          </button>
          {saved === "reflection" && (
            <p className="feedback-saved">
              <Check size={13} /> Reflection recorded
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
