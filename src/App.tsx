import { ChevronDown, Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createLearningWorkflow } from "./application/learningWorkflow";
import { createMemoryWorkflow } from "./application/memoryWorkflow";
import { createSourceWorkflow } from "./application/sourceWorkflow";
import {
  destinationForView,
  destinationFromUnderstandingGap,
  type WorkspaceDestination,
  type WorkspaceView
} from "./application/workspaceNavigation";
import { AddSourceDialog, type SourceMode } from "./components/AddSourceDialog";
import { Sidebar } from "./components/Sidebar";
import { reduceWorkspace } from "./domain/workspaceProjection";
import { UnderstandingView } from "./features/understanding/UnderstandingView";
import { useEvidenceLedger } from "./hooks/useEvidenceLedger";
import { AboutView } from "./views/AboutView";
import { FoundryView } from "./views/FoundryView";
import { LearnView } from "./views/LearnView";
import { MemoryView } from "./views/MemoryView";
import { SourcesView } from "./views/SourcesView";

const pageTitles: Record<WorkspaceView, [string, string]> = {
  sources: ["Source library", "Capture, process, and trace knowledge"],
  understanding: ["Understanding", "Maintain the shared theory and choose the next meaningful action"],
  learn: ["Learning studio", "Study, practice, recall, and reflect"],
  memory: ["Shared memory", "One ledger, three distinct projections"],
  foundry: ["Capability foundry", "Build, evaluate, approve, and revise"],
  about: ["System model", "Local-first shared human-agent learning"]
};

function App() {
  const { events, append, ready, error: ledgerError, rejectedCount } = useEvidenceLedger();
  const [view, setView] = useState<WorkspaceView>("understanding");
  const [selectedSourceId, setSelectedSourceId] = useState<string>();
  const [showAddSource, setShowAddSource] = useState(false);
  const [sourceMode, setSourceMode] = useState<SourceMode>("url");
  const [sourceInput, setSourceInput] = useState("");
  const [requestedLearnItemId, setRequestedLearnItemId] = useState<string>();
  const [selectedTheoryElementId, setSelectedTheoryElementId] = useState<string>();
  const [requestedCapabilityId, setRequestedCapabilityId] = useState<string>();
  const workspace = useMemo(() => reduceWorkspace(events), [events]);
  const explainersById = useMemo(
    () => new Map(workspace.explainers.map((explainer) => [explainer.id, explainer])),
    [workspace.explainers]
  );
  const understandingChecksById = useMemo(
    () => new Map(workspace.understandingChecks.map((check) => [check.id, check])),
    [workspace.understandingChecks]
  );
  const microWorldsById = useMemo(
    () => new Map(workspace.microWorlds.map((microWorld) => [microWorld.id, microWorld])),
    [workspace.microWorlds]
  );
  const understandingGapsById = useMemo(
    () => new Map(workspace.understandingGaps.gaps.map((gap) => [gap.id, gap])),
    [workspace.understandingGaps.gaps]
  );
  const sourceWorkflow = useMemo(() => createSourceWorkflow({ append }), [append]);
  const learningWorkflow = useMemo(
    () =>
      createLearningWorkflow({
        append,
        resolveExplainer: (artifactId) => explainersById.get(artifactId),
        resolveMicroWorld: (artifactId) => microWorldsById.get(artifactId),
        resolveUnderstandingCheck: (checkId) => understandingChecksById.get(checkId)
      }),
    [append, explainersById, microWorldsById, understandingChecksById]
  );
  const memoryWorkflow = useMemo(
    () =>
      createMemoryWorkflow({
        append,
        resolveGap: (gapId) => understandingGapsById.get(gapId)
      }),
    [append, understandingGapsById]
  );
  const { sources } = workspace;
  const activeTheoryElements = workspace.theory.elements.filter((element) => element.status !== "superseded");
  const currentTheoryElementId =
    activeTheoryElements.find((element) => element.id === selectedTheoryElementId)?.id ??
    activeTheoryElements.find((element) => element.kind === "purpose")?.id ??
    activeTheoryElements[0]?.id;
  const pageTitleRef = useRef<HTMLHeadingElement>(null);

  const selectedSource = sources.find((source) => source.id === selectedSourceId) ?? sources[0];
  useEffect(() => {
    document.title = `${pageTitles[view][0]} | Learning Foundry`;
    pageTitleRef.current?.focus();
  }, [view]);

  async function addSource() {
    const id = await sourceWorkflow.register(sourceMode, sourceInput);
    if (!id) return;
    setSelectedSourceId(id);
    setSourceInput("");
    setShowAddSource(false);
  }

  function navigate(destination: WorkspaceDestination) {
    if (destination.view === "sources" && destination.sourceId) setSelectedSourceId(destination.sourceId);
    if (destination.view === "understanding" && destination.theoryElementId) {
      setSelectedTheoryElementId(destination.theoryElementId);
    }
    if (destination.view === "learn" && destination.itemId) setRequestedLearnItemId(destination.itemId);
    if (destination.view === "memory" && destination.theoryElementId) {
      setSelectedTheoryElementId(destination.theoryElementId);
    }
    if (destination.view === "foundry" && destination.capabilityId) {
      setRequestedCapabilityId(destination.capabilityId);
    }
    setView(destination.view);
  }

  return (
    <div className="app-shell">
      <Sidebar
        view={view}
        setView={(nextView) => navigate(destinationForView(nextView))}
        eventCount={events.length}
        sourceCount={sources.length}
        theoryCount={workspace.theory.elements.filter((element) => element.status !== "superseded").length}
        atomCount={sources.reduce((total, source) => total + source.outputs.atoms, 0)}
      />
      <main className="main-shell">
        <header className="topbar">
          <div>
            <p className="eyebrow">Design intelligence / active workspace</p>
            <h1 ref={pageTitleRef} tabIndex={-1}>
              {pageTitles[view][0]}
            </h1>
            <p>{pageTitles[view][1]}</p>
          </div>
          <div className="top-actions">
            <button type="button" className="workspace-switcher">
              <span>Design intelligence</span>
              <ChevronDown size={14} />
            </button>
            <button type="button" className="primary-button" onClick={() => setShowAddSource(true)}>
              <Plus size={15} /> Add source
            </button>
          </div>
        </header>

        {(ledgerError || rejectedCount > 0) && (
          <p className="ledger-alert" role="status">
            {ledgerError ??
              `${rejectedCount} malformed memory ${rejectedCount === 1 ? "record was" : "records were"} quarantined.`}
          </p>
        )}

        {view === "sources" && (
          <SourcesView
            sources={sources}
            selectedSource={selectedSource}
            fragments={workspace.sourceFragments}
            proposals={workspace.synthesisProposals}
            setSelectedSourceId={setSelectedSourceId}
            onProcess={() => void sourceWorkflow.process(selectedSource, workspace).catch(() => undefined)}
            onApprove={(proposalId) =>
              void sourceWorkflow.review(proposalId, "approved", workspace).catch(() => undefined)
            }
            onReject={(proposalId) =>
              void sourceWorkflow.review(proposalId, "rejected", workspace).catch(() => undefined)
            }
            contextTitle={workspace.theory.title}
            onReturnToTheory={() => navigate({ view: "understanding" })}
          />
        )}
        {view === "understanding" && (
          <UnderstandingView
            workspace={workspace}
            loading={!ready}
            selectedElementId={currentTheoryElementId}
            onSelectElement={setSelectedTheoryElementId}
            onAddSource={() => setShowAddSource(true)}
            onNavigate={navigate}
          />
        )}
        {view === "learn" && (
          <LearnView
            requestedItemId={requestedLearnItemId}
            contextTitle={workspace.theory.title}
            onReturnToTheory={() => navigate({ view: "understanding" })}
            artifacts={workspace.learningArtifacts}
            explainers={workspace.explainers}
            microWorlds={workspace.microWorlds}
            checks={workspace.understandingChecks}
            evidenceVectors={workspace.understandingEvidenceVectors}
            reviewItems={workspace.targetedReviewItems}
            fragments={workspace.sourceFragments}
            sources={workspace.sources}
            onFeedback={learningWorkflow.recordExplainerFeedback}
            onResponse={learningWorkflow.recordUnderstandingResponse}
            onDispute={learningWorkflow.disputeUnderstandingEvaluation}
            onPreference={learningWorkflow.recordCheckPreference}
            onMicroWorldPrediction={learningWorkflow.recordMicroWorldPrediction}
            onMicroWorldInteraction={learningWorkflow.recordMicroWorldInteraction}
            onMicroWorldReflection={learningWorkflow.recordMicroWorldReflection}
          />
        )}
        {view === "memory" && (
          <MemoryView
            requestedTheoryElementId={currentTheoryElementId}
            events={events}
            theory={workspace.theory}
            projections={workspace.memories}
            understandingGaps={workspace.understandingGaps}
            onReviewGap={memoryWorkflow.reviewUnderstandingGap}
            onAnnotateGap={memoryWorkflow.annotateUnderstandingGap}
            onIntervene={(destination) => navigate(destinationFromUnderstandingGap(destination))}
            contextTitle={workspace.theory.title}
            onReturnToTheory={() => navigate({ view: "understanding" })}
          />
        )}
        {view === "foundry" && (
          <FoundryView
            capabilities={workspace.capabilities}
            requestedCapabilityId={requestedCapabilityId}
            contextTitle={workspace.theory.title}
            onReturnToTheory={() => navigate({ view: "understanding" })}
          />
        )}
        {view === "about" && <AboutView />}
      </main>

      {showAddSource && (
        <AddSourceDialog
          mode={sourceMode}
          setMode={setSourceMode}
          value={sourceInput}
          setValue={setSourceInput}
          onClose={() => setShowAddSource(false)}
          onAdd={() => void addSource().catch(() => undefined)}
        />
      )}
    </div>
  );
}

export default App;
