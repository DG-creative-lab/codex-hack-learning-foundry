import { Check, RotateCcw } from "lucide-react";
import type { MicroWorldProjection, MicroWorldVariableValues } from "../../domain/microWorld";

interface MicroWorldControlsProps {
  artifact: MicroWorldProjection;
  values: MicroWorldVariableValues;
  outcomesRevealed: boolean;
  configurationChanged: boolean;
  pending: boolean;
  saved: boolean;
  onValueChange: (variableId: string, value: number) => void;
  onReset: () => void;
  onRecord: () => void;
}

function displayValue(value: number, unit: string): string {
  if (unit === "percent") return `${value}%`;
  return `${value} ${unit}`;
}

export function MicroWorldControls({
  artifact,
  values,
  outcomesRevealed,
  configurationChanged,
  pending,
  saved,
  onValueChange,
  onReset,
  onRecord
}: MicroWorldControlsProps) {
  return (
    <aside className="micro-world-controls" aria-label="Micro-world controls">
      <div className="micro-world-section-heading">
        <div>
          <p className="eyebrow">Variables</p>
          <h3>Tune the queue</h3>
        </div>
        <button type="button" className="icon-button" title="Reset variables" onClick={onReset}>
          <RotateCcw size={14} />
        </button>
      </div>
      {artifact.controls.map((control) => {
        const variable = artifact.variables.find((item) => item.id === control.variableId);
        if (!variable) return null;
        const value = values[variable.id] ?? variable.initialValue;
        return (
          <label className="micro-world-control" key={control.id}>
            <span>
              <strong>{variable.label}</strong>
              <output htmlFor={control.id}>{displayValue(value, variable.unit)}</output>
            </span>
            <input
              id={control.id}
              type="range"
              min={variable.min}
              max={variable.max}
              step={variable.step}
              value={value}
              aria-label={variable.label}
              onInput={(event) => onValueChange(variable.id, Number(event.currentTarget.value))}
            />
            <small>{variable.description}</small>
          </label>
        );
      })}
      <button
        type="button"
        className="primary-button micro-world-record"
        disabled={!outcomesRevealed || !configurationChanged || pending}
        onClick={onRecord}
      >
        <Check size={15} /> Record configuration
      </button>
      {saved && (
        <p className="feedback-saved">
          <Check size={13} /> Interaction recorded
        </p>
      )}
    </aside>
  );
}
