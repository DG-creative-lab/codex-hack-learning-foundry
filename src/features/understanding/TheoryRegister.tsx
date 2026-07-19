import { GitBranch } from "lucide-react";
import type { KeyboardEvent } from "react";
import type { SharedTheoryProjection } from "../../domain/memoryProjections";
import type { TheoryElement } from "../../domain/types";
import { theoryKindLabels } from "./understandingFormat";

interface TheoryRegisterProps {
  elements: TheoryElement[];
  sharedTheory: SharedTheoryProjection;
  selectedElementId?: string;
  onSelect: (elementId: string) => void;
}

export function TheoryRegister({ elements, sharedTheory, selectedElementId, onSelect }: TheoryRegisterProps) {
  function moveSelection(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | undefined;
    if (event.key === "ArrowDown") nextIndex = (index + 1) % elements.length;
    if (event.key === "ArrowUp") nextIndex = (index - 1 + elements.length) % elements.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = elements.length - 1;
    if (nextIndex === undefined) return;
    event.preventDefault();
    const nextElement = elements[nextIndex];
    onSelect(nextElement.id);
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("button")[nextIndex]?.focus();
  }

  return (
    <section className="theory-register" aria-labelledby="theory-register-title">
      <header>
        <div>
          <p className="eyebrow">Shared model</p>
          <h3 id="theory-register-title">Living Theory</h3>
        </div>
        <GitBranch size={17} aria-hidden="true" />
      </header>
      <div role="listbox" aria-label="Theory elements">
        {elements.map((element, index) => {
          const memory = sharedTheory.elements.find((candidate) => candidate.theoryElementId === element.id);
          const selected = element.id === selectedElementId;
          return (
            <button
              type="button"
              role="option"
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              data-theory-id={element.id}
              key={element.id}
              className={selected ? "selected" : ""}
              onClick={() => onSelect(element.id)}
              onKeyDown={(event) => moveSelection(event, index)}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <span>
                <small>{theoryKindLabels[element.kind]}</small>
                <strong>{element.title}</strong>
              </span>
              <span
                className="theory-agreement-mark"
                role="img"
                data-agreement={memory?.agreement ?? "unresolved"}
                aria-label={`Agreement: ${memory?.agreement ?? "unresolved"}`}
              />
            </button>
          );
        })}
      </div>
    </section>
  );
}
