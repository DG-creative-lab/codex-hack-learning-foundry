import { useState } from "react";
import type { SharedTheoryProjection } from "../../domain/memoryProjections";
import { ProjectionEvidenceList } from "./ProjectionEvidenceList";

export function SharedTheoryProjectionView({ projection }: { projection: SharedTheoryProjection }) {
  const [selectedId, setSelectedId] = useState(projection.elements[0]?.theoryElementId);
  const selected =
    projection.elements.find((element) => element.theoryElementId === selectedId) ?? projection.elements[0];
  const covered = projection.elements.filter(
    (element) => element.coverage.source && element.coverage.human && element.coverage.agent
  ).length;

  return (
    <section
      id="memory-panel-shared"
      className="memory-projection-panel"
      role="tabpanel"
      aria-labelledby="memory-tab-shared"
    >
      <div className="shared-theory-summary">
        <div>
          <strong>{projection.elements.length}</strong>
          <span>Active elements</span>
        </div>
        <div>
          <strong>{covered}</strong>
          <span>Three-way coverage</span>
        </div>
        <div>
          <strong>{projection.unresolvedTheoryElementIds.length}</strong>
          <span>Unresolved</span>
        </div>
        <div>
          <strong>{projection.contradictionTheoryElementIds.length}</strong>
          <span>Contested</span>
        </div>
        <div>
          <strong>{projection.staleTheoryElementIds.length}</strong>
          <span>Stale</span>
        </div>
      </div>

      <div className="memory-inspection-grid shared-inspection-grid">
        <section className="shared-theory-register">
          <header className="shared-register-head">
            <span>Theory element</span>
            <span>Coverage</span>
            <span>Agreement</span>
            <span>Freshness</span>
          </header>
          {projection.elements.map((element) => (
            <button
              type="button"
              key={element.theoryElementId}
              className={element.theoryElementId === selected?.theoryElementId ? "selected" : ""}
              onClick={() => setSelectedId(element.theoryElementId)}
            >
              <span>
                <small>{element.kind.replaceAll("_", " ")}</small>
                <strong>{element.title}</strong>
              </span>
              <span className="coverage-marks">
                <abbr title="Source coverage" data-covered={element.coverage.source}>
                  S
                </abbr>
                <abbr title="Human evidence coverage" data-covered={element.coverage.human}>
                  H
                </abbr>
                <abbr title="Agent contribution coverage" data-covered={element.coverage.agent}>
                  A
                </abbr>
              </span>
              <span data-agreement={element.agreement}>{element.agreement}</span>
              <span data-freshness={element.freshness}>{element.freshness}</span>
            </button>
          ))}
        </section>

        {selected && (
          <aside className="memory-evidence-inspector">
            <div className="memory-inspector-heading">
              <p className="eyebrow">Selected shared theory</p>
              <h3>{selected.title}</h3>
              <p>{selected.theoryElementId}</p>
            </div>
            <ProjectionEvidenceList
              title="Supporting"
              references={selected.supportingEvidence}
              emptyLabel="No supporting evidence is linked."
              tone="support"
            />
            <ProjectionEvidenceList
              title="Contradictory"
              references={selected.contradictoryEvidence}
              emptyLabel="No contradictory evidence is linked."
              tone="challenge"
            />
          </aside>
        )}
      </div>
    </section>
  );
}
