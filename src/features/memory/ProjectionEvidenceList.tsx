import type { MemoryEvidenceReference } from "../../domain/memoryProjections";

interface ProjectionEvidenceListProps {
  title: string;
  references: MemoryEvidenceReference[];
  emptyLabel: string;
  tone: "support" | "mixed" | "challenge";
}

function formatDate(value: string) {
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function ProjectionEvidenceList({ title, references, emptyLabel, tone }: ProjectionEvidenceListProps) {
  return (
    <section className="projection-evidence-list" data-tone={tone}>
      <header>
        <h4>{title}</h4>
        <span>{references.length}</span>
      </header>
      {references.length === 0 ? (
        <p className="projection-empty">{emptyLabel}</p>
      ) : (
        <ol>
          {references.map((reference) => (
            <li key={reference.eventId}>
              <div>
                <time>{formatDate(reference.createdAt)}</time>
                <span>{reference.kind.replaceAll("_", " ")}</span>
              </div>
              <strong>{reference.summary}</strong>
              <p>{reference.rationale}</p>
              <code>{reference.eventId}</code>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
