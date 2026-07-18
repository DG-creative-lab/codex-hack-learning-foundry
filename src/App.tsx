import { ChevronDown, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { AddSourceDialog, type SourceMode } from "./components/AddSourceDialog";
import { Sidebar, type ViewId } from "./components/Sidebar";
import { designDensityTheoryMetadata } from "./data/sample";
import { deriveLivingTheory } from "./domain/livingTheory";
import { deriveMemoryProjections } from "./domain/memoryProjections";
import { deriveSources, type SourceOrigin, type SourceRecord } from "./domain/sourceProjection";
import type { EvidenceEvent, EvidenceKind } from "./domain/types";
import { useEvidenceLedger } from "./hooks/useEvidenceLedger";
import { AboutView } from "./views/AboutView";
import { FoundryView } from "./views/FoundryView";
import { LearnView } from "./views/LearnView";
import { MemoryView } from "./views/MemoryView";
import { SourcesView } from "./views/SourcesView";

function makeEvent(type: string, kind: EvidenceKind, actor: EvidenceEvent["actor"], summary: string, sourceIds: string[] = [], payload: Record<string, unknown> = {}): EvidenceEvent {
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
  const sources = useMemo(() => deriveSources(events), [events]);

  const livingTheory = useMemo(() => deriveLivingTheory(events, {
    ...designDensityTheoryMetadata,
    sourceIds: sources.map((source) => source.id)
  }), [events, sources]);
  const memoryProjections = useMemo(
    () => deriveMemoryProjections(livingTheory, events),
    [events, livingTheory]
  );

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
    await append(makeEvent("source.registered", "source_fact", "system", `Captured ${title}; extraction is queued.`, [id], { source: record }));
    setSelectedSourceId(id);
    setSourceInput("");
    setShowAddSource(false);
  }

  async function processSelectedSource() {
    if (!selectedSource || selectedSource.status === "ready") return;
    await append(makeEvent("source.processing_started", "practical_observation", "system", `Extraction and provenance capture started for ${selectedSource.title}.`, [selectedSource.id], { sourceId: selectedSource.id, progress: 42 }));
    window.setTimeout(() => {
      void append(makeEvent("source.processing_completed", "agent_synthesis", "agent", `Structured knowledge and a learning-module proposal were produced from ${selectedSource.title}.`, [selectedSource.id], {
        sourceId: selectedSource.id,
        author: "Extracted source",
        outputs: { atoms: 7, lessons: 1, capabilities: 0 }
      })).catch(() => undefined);
    }, 900);
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
            <button className="workspace-switcher"><span>Design intelligence</span><ChevronDown size={14} /></button>
            <button className="primary-button" onClick={() => setShowAddSource(true)}><Plus size={15} /> Add source</button>
          </div>
        </header>

        {(ledgerError || rejectedCount > 0) && (
          <p className="ledger-alert" role="status">
            {ledgerError ?? `${rejectedCount} malformed memory ${rejectedCount === 1 ? "record was" : "records were"} quarantined.`}
          </p>
        )}

        {view === "sources" && (
          <SourcesView
            sources={sources}
            selectedSource={selectedSource}
            setSelectedSourceId={setSelectedSourceId}
            onProcess={() => void processSelectedSource().catch(() => undefined)}
          />
        )}
        {view === "learn" && <LearnView />}
        {view === "memory" && <MemoryView events={events} theory={livingTheory} projections={memoryProjections} />}
        {view === "foundry" && <FoundryView />}
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
