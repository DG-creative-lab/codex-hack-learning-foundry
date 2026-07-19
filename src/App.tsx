import { ChevronDown, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { createLearningWorkflow } from "./application/learningWorkflow";
import { createSourceWorkflow } from "./application/sourceWorkflow";
import { AddSourceDialog, type SourceMode } from "./components/AddSourceDialog";
import { Sidebar, type ViewId } from "./components/Sidebar";
import { reduceWorkspace } from "./domain/workspaceProjection";
import { useEvidenceLedger } from "./hooks/useEvidenceLedger";
import { AboutView } from "./views/AboutView";
import { FoundryView } from "./views/FoundryView";
import { LearnView } from "./views/LearnView";
import { MemoryView } from "./views/MemoryView";
import { SourcesView } from "./views/SourcesView";

function App() {
  const { events, append, error: ledgerError, rejectedCount } = useEvidenceLedger();
  const [view, setView] = useState<ViewId>("sources");
  const [selectedSourceId, setSelectedSourceId] = useState<string>();
  const [showAddSource, setShowAddSource] = useState(false);
  const [sourceMode, setSourceMode] = useState<SourceMode>("url");
  const [sourceInput, setSourceInput] = useState("");
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
  const { sources } = workspace;

  const selectedSource = sources.find((source) => source.id === selectedSourceId) ?? sources[0];
  const pageTitles: Record<ViewId, [string, string]> = {
    sources: ["Source library", "Capture, process, and trace knowledge"],
    learn: ["Learning studio", "Study, practice, recall, and reflect"],
    memory: ["Shared memory", "One ledger, three distinct projections"],
    foundry: ["Capability foundry", "Build, evaluate, approve, and revise"],
    about: ["System model", "Local-first shared human-agent learning"]
  };

  async function addSource() {
    const id = await sourceWorkflow.register(sourceMode, sourceInput);
    if (!id) return;
    setSelectedSourceId(id);
    setSourceInput("");
    setShowAddSource(false);
  }

  return (
    <div className="app-shell">
      <Sidebar
        view={view}
        setView={setView}
        eventCount={events.length}
        sourceCount={sources.length}
        atomCount={sources.reduce((total, source) => total + source.outputs.atoms, 0)}
      />
      <main className="main-shell">
        <header className="topbar">
          <div>
            <p className="eyebrow">Design intelligence / active workspace</p>
            <h1>{pageTitles[view][0]}</h1>
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
          />
        )}
        {view === "learn" && (
          <LearnView
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
        {view === "memory" && <MemoryView events={events} theory={workspace.theory} projections={workspace.memories} />}
        {view === "foundry" && <FoundryView capabilities={workspace.capabilities} />}
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
