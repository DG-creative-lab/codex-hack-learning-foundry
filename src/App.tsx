import { ChevronDown, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { AddSourceDialog, type SourceMode } from "./components/AddSourceDialog";
import { Sidebar, type ViewId } from "./components/Sidebar";
import { createSynthesisProposal, normalizeExtractedDocument, proposalReviewEvent } from "./domain/sourcePipeline";
import type { SourceOrigin, SourceRecord } from "./domain/sourceProjection";
import type { EvidenceEvent, EvidenceKind } from "./domain/types";
import { reduceWorkspace } from "./domain/workspaceProjection";
import { useEvidenceLedger } from "./hooks/useEvidenceLedger";
import { extractSource } from "./services/sourceExtraction";
import { AboutView } from "./views/AboutView";
import { FoundryView } from "./views/FoundryView";
import { LearnView } from "./views/LearnView";
import { MemoryView } from "./views/MemoryView";
import { SourcesView } from "./views/SourcesView";

function makeEvent(
  type: string,
  kind: EvidenceKind,
  actor: EvidenceEvent["actor"],
  summary: string,
  sourceIds: string[] = [],
  payload: Record<string, unknown> = {}
): EvidenceEvent {
  return {
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    kind,
    actor,
    createdAt: new Date().toISOString(),
    summary,
    sourceIds,
    payload
  };
}

function App() {
  const { events, append, error: ledgerError, rejectedCount } = useEvidenceLedger();
  const [view, setView] = useState<ViewId>("sources");
  const [selectedSourceId, setSelectedSourceId] = useState<string>();
  const [showAddSource, setShowAddSource] = useState(false);
  const [sourceMode, setSourceMode] = useState<SourceMode>("url");
  const [sourceInput, setSourceInput] = useState("");
  const workspace = useMemo(() => reduceWorkspace(events), [events]);
  const { sources } = workspace;

  const selectedSource = sources.find((source) => source.id === selectedSourceId) ?? sources[0];
  const pageTitles: Record<ViewId, [string, string]> = {
    sources: ["Source library", "Capture, process, and trace knowledge"],
    learn: ["Learning studio", "Study, practice, recall, and reflect"],
    memory: ["Shared memory", "One evidence layer, two learning states"],
    foundry: ["Capability foundry", "Build, evaluate, approve, and revise"],
    about: ["System model", "Local-first shared human-agent learning"]
  };

  async function addSource() {
    if (!sourceInput.trim()) return;
    const origin: SourceOrigin = sourceMode === "local" ? "local" : "web";
    const id = `source-${Date.now()}`;
    let title = sourceInput.split("/").pop() || "Local source";
    if (sourceMode === "url") {
      try {
        title = new URL(sourceInput).hostname;
      } catch {
        title = sourceInput;
      }
    }
    const record: SourceRecord = {
      id,
      title,
      author: "Pending extraction",
      origin,
      format: sourceMode === "local" ? "Local file" : "Web page",
      status: "queued",
      progress: 0,
      addedAt: "Just now",
      provenance: sourceInput,
      outputs: { atoms: 0, lessons: 0, capabilities: 0 }
    };
    await append(
      makeEvent("source.registered", "source_fact", "system", `Captured ${title}; extraction is queued.`, [id], {
        source: record
      })
    );
    setSelectedSourceId(id);
    setSourceInput("");
    setShowAddSource(false);
  }

  async function processSelectedSource() {
    if (!selectedSource || selectedSource.status === "processing") return;
    const now = new Date().toISOString();
    await append(
      makeEvent(
        "source.processing_started",
        "practical_observation",
        "system",
        `Extraction and provenance capture started for ${selectedSource.title}.`,
        [selectedSource.id],
        { sourceId: selectedSource.id, progress: 18 }
      )
    );
    const result = await extractSource({
      origin: selectedSource.origin === "web" ? "web" : "local",
      provenance: selectedSource.provenance
    });
    if (!result.ok) {
      await append(
        makeEvent(
          "source.processing_failed",
          "practical_observation",
          "system",
          result.error.message,
          [selectedSource.id],
          {
            sourceId: selectedSource.id,
            error: result.error
          }
        )
      );
      return;
    }

    const normalized = normalizeExtractedDocument(
      selectedSource.id,
      result.document,
      now,
      selectedSource.currentVersionId
    );
    if (normalized.version.id === selectedSource.currentVersionId) {
      await append(
        makeEvent(
          "source.processing_completed",
          "practical_observation",
          "system",
          `${selectedSource.title} is unchanged.`,
          [selectedSource.id],
          {
            sourceId: selectedSource.id,
            author: result.document.author,
            title: result.document.title,
            format: result.document.format,
            outputs: selectedSource.outputs
          }
        )
      );
      return;
    }
    const previousApproved = workspace.synthesisProposals.find(
      (proposal) => proposal.sourceId === selectedSource.id && proposal.status === "approved"
    );
    const proposalId = `synthesis-${selectedSource.id}-${Date.now()}`;
    const proposal = createSynthesisProposal(
      selectedSource.id,
      normalized.version,
      normalized.fragments,
      proposalId,
      now,
      previousApproved
    );
    await append(
      makeEvent(
        "source.synthesis_completed",
        "agent_synthesis",
        "agent",
        `Extracted ${normalized.fragments.length} fragments and proposed ${proposal.elements.length} theory elements for review.`,
        [selectedSource.id],
        {
          sourceId: selectedSource.id,
          author: result.document.author,
          title: result.document.title,
          format: result.document.format,
          outputs: { ...selectedSource.outputs, atoms: proposal.elements.length },
          version: normalized.version,
          fragments: normalized.fragments,
          proposal
        }
      )
    );
  }

  async function approveProposal(proposalId: string) {
    const proposal = workspace.synthesisProposals.find((candidate) => candidate.id === proposalId);
    if (proposal?.status !== "pending") return;
    await append(proposalReviewEvent(proposal, "approved", new Date().toISOString()));
  }

  async function rejectProposal(proposalId: string) {
    const proposal = workspace.synthesisProposals.find((candidate) => candidate.id === proposalId);
    if (proposal?.status !== "pending") return;
    await append(proposalReviewEvent(proposal, "rejected", new Date().toISOString()));
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
            onProcess={() => void processSelectedSource().catch(() => undefined)}
            onApprove={(proposalId) => void approveProposal(proposalId).catch(() => undefined)}
            onReject={(proposalId) => void rejectProposal(proposalId).catch(() => undefined)}
          />
        )}
        {view === "learn" && <LearnView artifacts={workspace.learningArtifacts} />}
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
