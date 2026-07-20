import { AlertTriangle, ArrowRight, BookOpen, CheckCircle2, LoaderCircle } from "lucide-react";
import type { WorkspaceDestination } from "../../application/workspaceNavigation";
import type { WorkspaceProjection } from "../../domain/workspaceProjection";
import { TheoryInspector } from "./TheoryInspector";
import { TheoryRegister } from "./TheoryRegister";
import { UnderstandingActionRail } from "./UnderstandingActionRail";
import { deriveUnderstandingNextAction, deriveUnderstandingWorkspaceState } from "./understandingModel";
import "./understanding.css";

interface UnderstandingViewProps {
  workspace: WorkspaceProjection;
  loading: boolean;
  selectedElementId?: string;
  onSelectElement: (elementId: string) => void;
  onAddSource: () => void;
  onNavigate: (destination: WorkspaceDestination) => void;
}

const stateCopy = {
  active: ["Active", "Evidence and learning work remain in motion."],
  empty: ["No theory yet", "Add and approve a source to establish the first shared claims."],
  loading: ["Loading", "Replaying the append-only evidence ledger."],
  "extraction-failure": ["Source blocked", "A failed extraction is preventing new evidence from entering theory."],
  contradiction: ["Contradiction open", "Conflicting evidence needs inspection before it guides action."],
  stale: ["Evidence stale", "At least one theory element needs a current observation."],
  completed: ["Journey complete", "No bounded detector identifies a more meaningful next action."]
} as const;

export function UnderstandingView({
  workspace,
  loading,
  selectedElementId,
  onSelectElement,
  onAddSource,
  onNavigate
}: UnderstandingViewProps) {
  const activeElements = workspace.theory.elements.filter((element) => element.status !== "superseded");
  const initialElement = activeElements.find((element) => element.kind === "purpose") ?? activeElements[0];
  const selectedElement = activeElements.find((element) => element.id === selectedElementId) ?? initialElement;
  const state = deriveUnderstandingWorkspaceState(workspace, loading);
  const nextAction = deriveUnderstandingNextAction(workspace);
  const sharedElement = workspace.memories.shared.elements.find(
    (element) => element.theoryElementId === selectedElement?.id
  );
  const relatedRelationships = workspace.theory.relationships.filter(
    (relationship) =>
      relationship.fromElementId === selectedElement?.id || relationship.toElementId === selectedElement?.id
  );
  const questions = activeElements.filter((element) => element.kind === "question" || element.status === "unresolved");
  const stateLabel = stateCopy[state];

  function openNextAction() {
    if ("destination" in nextAction) onNavigate(nextAction.destination);
    else if (selectedElement) onNavigate({ view: "memory", theoryElementId: selectedElement.id });
  }

  if (state === "loading") {
    return (
      <div className="page-scroll understanding-view understanding-state-view" aria-busy="true">
        <LoaderCircle size={24} aria-hidden="true" />
        <p className="eyebrow">Understanding workspace</p>
        <h2>Replaying evidence</h2>
        <p>The Living Theory and its projections are being reconstructed.</p>
      </div>
    );
  }

  if (state === "empty") {
    return (
      <div className="page-scroll understanding-view understanding-state-view">
        <BookOpen size={24} aria-hidden="true" />
        <p className="eyebrow">Living Theory / revision 00</p>
        <h2>No shared theory yet</h2>
        <p>Add a source, inspect its synthesis, and approve the claims that should become shared context.</p>
        <button type="button" className="primary-button" onClick={onAddSource}>
          Add source <ArrowRight size={15} aria-hidden="true" />
        </button>
      </div>
    );
  }

  if (state === "extraction-failure" && activeElements.length === 0) {
    return (
      <div className="page-scroll understanding-view understanding-state-view" data-workspace-state={state}>
        <AlertTriangle size={24} aria-hidden="true" />
        <p className="eyebrow">Living Theory / source recovery</p>
        <h2>Source extraction failed</h2>
        <p>{nextAction.why}</p>
        <button type="button" className="primary-button" onClick={openNextAction}>
          {nextAction.label} <ArrowRight size={15} aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <div className="page-scroll understanding-view" data-workspace-state={state}>
      <section className="understanding-objective">
        <div>
          <p className="eyebrow">Current objective / revision {String(workspace.theory.revision).padStart(2, "0")}</p>
          <h2>{workspace.theory.title}</h2>
          <p>{workspace.theory.summary}</p>
        </div>
        <dl>
          <div>
            <dt>Theory</dt>
            <dd>{activeElements.length} elements</dd>
          </div>
          <div>
            <dt>Evidence</dt>
            <dd>{workspace.theory.evidenceEventIds.length} events</dd>
          </div>
          <div>
            <dt>Open</dt>
            <dd>{workspace.understandingGaps.openCount} signals</dd>
          </div>
        </dl>
      </section>

      <section className="understanding-state-band" aria-label="Workspace state" data-state={state}>
        <span>{state === "completed" ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}</span>
        <strong>{stateLabel[0]}</strong>
        <p>{stateLabel[1]}</p>
        <span>{new Date(workspace.memories.asOf).toLocaleDateString()}</span>
      </section>

      <section className="understanding-workspace">
        <TheoryRegister
          elements={activeElements}
          sharedTheory={workspace.memories.shared}
          selectedElementId={selectedElement?.id}
          onSelect={onSelectElement}
        />
        {selectedElement && (
          <TheoryInspector
            element={selectedElement}
            sharedElement={sharedElement}
            activeElements={activeElements}
            relationships={relatedRelationships}
            sources={workspace.sources}
            fragments={workspace.sourceFragments}
            onSelectTheory={onSelectElement}
            onOpenSource={(sourceId) => onNavigate({ view: "sources", sourceId })}
            onOpenMemory={(theoryElementId) => onNavigate({ view: "memory", theoryElementId })}
          />
        )}
        <UnderstandingActionRail
          nextAction={nextAction}
          questions={questions}
          evidenceCount={workspace.theory.evidenceEventIds.length}
          onOpenNextAction={openNextAction}
          onSelectQuestion={onSelectElement}
        />
      </section>
    </div>
  );
}
