import { ArrowRight, Database } from "lucide-react";
import type { SharedTheoryElementProjection } from "../../domain/memoryProjections";
import type { TheoryElement, TheoryRelationship } from "../../domain/types";
import type { WorkspaceProjection } from "../../domain/workspaceProjection";
import { sourceLocationLabel, theoryKindLabels } from "./understandingFormat";

interface TheoryInspectorProps {
  element: TheoryElement;
  sharedElement?: SharedTheoryElementProjection;
  activeElements: TheoryElement[];
  relationships: TheoryRelationship[];
  sources: WorkspaceProjection["sources"];
  fragments: WorkspaceProjection["sourceFragments"];
  onSelectTheory: (elementId: string) => void;
  onOpenSource: (sourceId: string) => void;
  onOpenMemory: (theoryElementId: string) => void;
}

export function TheoryInspector({
  element,
  sharedElement,
  activeElements,
  relationships,
  sources,
  fragments,
  onSelectTheory,
  onOpenSource,
  onOpenMemory
}: TheoryInspectorProps) {
  const sourcesById = new Map(sources.map((source) => [source.id, source]));
  const fragmentsById = new Map(fragments.map((fragment) => [fragment.id, fragment]));

  return (
    <article className="theory-inspector">
      <header>
        <p className="eyebrow">Selected {theoryKindLabels[element.kind]}</p>
        <h3>{element.title}</h3>
        <p>{element.statement}</p>
      </header>

      <dl className="theory-state-matrix">
        <div>
          <dt>Agreement</dt>
          <dd data-agreement={sharedElement?.agreement}>{sharedElement?.agreement ?? "unresolved"}</dd>
        </div>
        <div>
          <dt>Freshness</dt>
          <dd data-freshness={sharedElement?.freshness}>{sharedElement?.freshness ?? "unobserved"}</dd>
        </div>
        <div>
          <dt>Authorship</dt>
          <dd>{element.epistemicKind.replaceAll("_", " ")}</dd>
        </div>
      </dl>

      <section className="theory-provenance">
        <div className="understanding-section-title">
          <h4>Source context</h4>
          <span>{element.sourceIds.length}</span>
        </div>
        {element.sourceIds.length === 0 ? (
          <p className="understanding-empty-line">No source is asserted for this interpretation.</p>
        ) : (
          <div className="theory-source-links">
            {element.sourceIds.map((sourceId) => (
              <button type="button" key={sourceId} onClick={() => onOpenSource(sourceId)}>
                <Database size={14} aria-hidden="true" />
                <span>
                  <strong>{sourcesById.get(sourceId)?.title ?? sourceId}</strong>
                  <small>{sourcesById.get(sourceId)?.author}</small>
                </span>
                <ArrowRight size={14} aria-hidden="true" />
              </button>
            ))}
          </div>
        )}
        {element.fragmentIds.map((fragmentId) => {
          const fragment = fragmentsById.get(fragmentId);
          if (!fragment) return null;
          return (
            <blockquote key={fragment.id}>
              <span>{sourceLocationLabel(fragment.location)}</span>
              <p>{fragment.content}</p>
            </blockquote>
          );
        })}
      </section>

      <section className="theory-evidence-trail">
        <div className="understanding-section-title">
          <h4>Memory evidence</h4>
          <button type="button" onClick={() => onOpenMemory(element.id)}>
            Inspect projection <ArrowRight size={13} aria-hidden="true" />
          </button>
        </div>
        {[...(sharedElement?.contradictoryEvidence ?? []), ...(sharedElement?.supportingEvidence ?? [])]
          .slice(0, 4)
          .map((evidence) => (
            <button type="button" key={evidence.eventId} onClick={() => onOpenMemory(element.id)}>
              <span data-signal={evidence.signal} />
              <span>
                <strong>{evidence.summary}</strong>
                <small>{evidence.rationale}</small>
              </span>
              <time>{new Date(evidence.createdAt).toLocaleDateString()}</time>
            </button>
          ))}
      </section>

      {relationships.length > 0 && (
        <section className="theory-relationships">
          <div className="understanding-section-title">
            <h4>Relationships</h4>
            <span>{relationships.length}</span>
          </div>
          {relationships.map((relationship) => {
            const otherId =
              relationship.fromElementId === element.id ? relationship.toElementId : relationship.fromElementId;
            const other = activeElements.find((candidate) => candidate.id === otherId);
            return (
              <button type="button" key={relationship.id} onClick={() => onSelectTheory(otherId)}>
                <span>{relationship.kind}</span>
                <strong>{other?.title ?? otherId}</strong>
              </button>
            );
          })}
        </section>
      )}
    </article>
  );
}
