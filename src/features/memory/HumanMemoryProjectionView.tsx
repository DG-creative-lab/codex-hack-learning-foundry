import { useMemo, useState } from "react";
import {
  type HumanMemoryDimension,
  type HumanMemoryProjection,
  humanMemoryDimensionSchema,
  type MemoryEvidenceReference
} from "../../domain/memoryProjections";
import { ProjectionEvidenceList } from "./ProjectionEvidenceList";

const dimensionLabels: Record<HumanMemoryDimension, string> = {
  recall: "Recall",
  explanation: "Explanation",
  prediction: "Prediction",
  transfer: "Transfer",
  participation: "Participation",
  uncertainty: "Uncertainty"
};

function unique(references: MemoryEvidenceReference[]) {
  return [...new Map(references.map((reference) => [reference.eventId, reference])).values()];
}

export function HumanMemoryProjectionView({ projection }: { projection: HumanMemoryProjection }) {
  const defaultElement =
    projection.elements.find((element) => element.lastObservedAt)?.theoryElementId ??
    projection.elements[0]?.theoryElementId;
  const [selectedId, setSelectedId] = useState(defaultElement);
  const selected =
    projection.elements.find((element) => element.theoryElementId === selectedId) ?? projection.elements[0];
  const dimensionSummary = useMemo(
    () =>
      humanMemoryDimensionSchema.options.map((dimension) => {
        const values = projection.elements.map((element) => element.dimensions[dimension]);
        return {
          dimension,
          support: unique(values.flatMap((value) => value.supportingEvidence)).length,
          mixed: unique(values.flatMap((value) => value.mixedEvidence)).length,
          challenge: unique(values.flatMap((value) => value.contradictoryEvidence)).length
        };
      }),
    [projection]
  );

  return (
    <section
      id="memory-panel-human"
      className="memory-projection-panel"
      role="tabpanel"
      aria-labelledby="memory-tab-human"
    >
      <div className="memory-dimension-index">
        {dimensionSummary.map(({ dimension, support, mixed, challenge }, index) => {
          const state = challenge > 0 ? "Challenged" : mixed > 0 ? "Mixed" : support > 0 ? "Observed" : "Unobserved";
          return (
            <div key={dimension} data-state={state.toLowerCase()}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{dimensionLabels[dimension]}</strong>
              <small>{state}</small>
              <code>
                {support} / {mixed} / {challenge}
              </code>
            </div>
          );
        })}
      </div>

      <div className="memory-inspection-grid">
        <section className="memory-theory-index">
          <header className="memory-index-head">
            <span>Theory element</span>
            <span>Observed</span>
            <span>Freshness</span>
          </header>
          {projection.elements.map((element) => {
            const observedDimensions = Object.values(element.dimensions).filter(
              (dimension) => dimension.freshness !== "unobserved"
            ).length;
            return (
              <button
                type="button"
                key={element.theoryElementId}
                className={element.theoryElementId === selected?.theoryElementId ? "selected" : ""}
                onClick={() => setSelectedId(element.theoryElementId)}
              >
                <span>
                  <strong>{element.title}</strong>
                  <code>{element.theoryElementId}</code>
                </span>
                <span>{observedDimensions} / 6</span>
                <span data-freshness={element.freshness}>{element.freshness}</span>
              </button>
            );
          })}
        </section>

        {selected && (
          <aside className="memory-evidence-inspector">
            <div className="memory-inspector-heading">
              <p className="eyebrow">Selected human evidence</p>
              <h3>{selected.title}</h3>
              <p>No signal changes source truth or capability state.</p>
            </div>
            <ProjectionEvidenceList
              title="Supporting"
              references={selected.supportingEvidence}
              emptyLabel="No supporting human evidence has been recorded."
              tone="support"
            />
            <ProjectionEvidenceList
              title="Mixed or unassessed"
              references={unique(Object.values(selected.dimensions).flatMap((dimension) => dimension.mixedEvidence))}
              emptyLabel="No mixed evidence has been recorded."
              tone="mixed"
            />
            <ProjectionEvidenceList
              title="Challenging"
              references={selected.contradictoryEvidence}
              emptyLabel="No challenging human evidence has been recorded."
              tone="challenge"
            />
          </aside>
        )}
      </div>
    </section>
  );
}
