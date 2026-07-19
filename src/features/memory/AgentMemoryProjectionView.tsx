import type { AgentMemoryProjection, AgentTheoryMemoryItem } from "../../domain/memoryProjections";
import { ProjectionEvidenceList } from "./ProjectionEvidenceList";

export function AgentMemoryProjectionView({ projection }: { projection: AgentMemoryProjection }) {
  const categories = [
    { label: "Knowledge", value: projection.knowledge.length },
    { label: "Assumptions", value: projection.assumptions.length },
    { label: "Boundaries", value: projection.boundaries.length },
    { label: "Decisions", value: projection.decisions.length },
    { label: "Evaluations", value: projection.evaluations.length },
    { label: "Failures", value: projection.failures.length },
    { label: "Versions", value: projection.capabilityVersions.length }
  ];
  const theoryGroups: Array<{ label: string; items: AgentTheoryMemoryItem[] }> = [
    { label: "Knowledge", items: projection.knowledge },
    { label: "Assumptions", items: projection.assumptions },
    { label: "Boundaries", items: projection.boundaries },
    { label: "Decisions", items: projection.decisions }
  ];

  return (
    <section
      id="memory-panel-agent"
      className="memory-projection-panel"
      role="tabpanel"
      aria-labelledby="memory-tab-agent"
    >
      <div className="agent-memory-index">
        {categories.map((category, index) => (
          <div key={category.label}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{category.value}</strong>
            <small>{category.label}</small>
          </div>
        ))}
      </div>

      <div className="agent-memory-grid">
        <section className="agent-theory-register">
          <header>
            <p className="eyebrow">Accessible theory</p>
            <h3>Knowledge, assumptions, and operating limits</h3>
          </header>
          {theoryGroups.map(({ label, items }) => {
            return (
              <section key={String(label)}>
                <h4>{label}</h4>
                <span>{items.length}</span>
                {items.length === 0 ? (
                  <p>None recorded.</p>
                ) : (
                  <ul>
                    {items.map((item) => (
                      <li key={item.theoryElementId}>
                        <strong>{item.title}</strong>
                        <span data-freshness={item.freshness}>{item.freshness}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </section>

        <aside className="memory-evidence-inspector agent-evidence-inspector">
          <div className="memory-inspector-heading">
            <p className="eyebrow">Capability record</p>
            <h3>Evaluation does not imply human understanding.</h3>
          </div>
          <section className="capability-version-register">
            <header>
              <h4>Capability versions</h4>
              <span>{projection.capabilityVersions.length}</span>
            </header>
            {projection.capabilityVersions.map((version) => (
              <div key={`${version.capabilityId}:${version.version}`}>
                <strong>{version.name}</strong>
                <code>{version.version}</code>
                <span>{version.status}</span>
              </div>
            ))}
          </section>
          <ProjectionEvidenceList
            title="Supporting"
            references={projection.supportingEvidence}
            emptyLabel="No supporting agent evidence has been recorded."
            tone="support"
          />
          <ProjectionEvidenceList
            title="Failures and contradictions"
            references={projection.contradictoryEvidence}
            emptyLabel="No capability failures or theory contradictions are recorded."
            tone="challenge"
          />
        </aside>
      </div>
    </section>
  );
}
