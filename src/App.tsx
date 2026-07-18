import {
  ArrowRight,
  BookOpen,
  Bot,
  Check,
  ChevronDown,
  CircleDot,
  ExternalLink,
  FileText,
  FlaskConical,
  GitBranch,
  Globe2,
  GraduationCap,
  History,
  Info,
  Library,
  Link2,
  Network,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Upload,
  UserRound,
  Wrench,
  X
} from "lucide-react";
import { useMemo, useState } from "react";
import { designDensityTheoryMetadata } from "./data/sample";
import { capabilities, learningArtifacts } from "./data/workspace";
import { deriveLivingTheory } from "./domain/livingTheory";
import { deriveMemoryProjections, type MemoryProjections } from "./domain/memoryProjections";
import { deriveSources, type SourceOrigin, type SourceRecord } from "./domain/sourceProjection";
import type { EvidenceEvent, EvidenceKind, LivingTheory } from "./domain/types";
import { useEvidenceLedger } from "./hooks/useEvidenceLedger";

type ViewId = "sources" | "learn" | "memory" | "foundry" | "about";

const kindLabels: Record<EvidenceKind, string> = {
  source_fact: "Source fact",
  user_interpretation: "Human interpretation",
  agent_synthesis: "Agent synthesis",
  practical_observation: "Practical observation",
  hypothesis: "Hypothesis",
  validated_behavior: "Validated behavior"
};

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
  const [sourceMode, setSourceMode] = useState<"url" | "local">("url");
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

function Sidebar({ view, setView, eventCount, sourceCount, atomCount }: { view: ViewId; setView: (view: ViewId) => void; eventCount: number; sourceCount: number; atomCount: number }) {
  const items: Array<[ViewId, string, React.ReactNode, string]> = [
    ["sources", "Sources", <Library size={17} />, "01"],
    ["learn", "Learn", <GraduationCap size={17} />, "02"],
    ["memory", "Memory", <Network size={17} />, eventCount.toString().padStart(2, "0")],
    ["foundry", "Foundry", <Wrench size={17} />, "03"]
  ];
  return (
    <aside className="sidebar">
      <div className="window-drag" />
      <div className="brand-block">
        <div className="brand-mark" aria-hidden="true"><span /><span /><span /></div>
        <div><p className="brand-name">Learning<br />Foundry</p><p className="brand-edition">Build week / 01</p></div>
      </div>
      <nav className="primary-nav" aria-label="Primary navigation">
        {items.map(([id, label, icon, count]) => (
          <button key={id} className={view === id ? "active" : ""} onClick={() => setView(id)}>{icon}{label}<span>{count}</span></button>
        ))}
      </nav>
      <div className="sidebar-project">
        <p className="eyebrow">Active project</p>
        <strong>Design intelligence</strong>
        <span>{sourceCount} sources / {atomCount} atoms</span>
      </div>
      <button className={`about-nav ${view === "about" ? "active" : ""}`} onClick={() => setView("about")}><Info size={16} /> System model</button>
      <div className="sidebar-status"><p className="eyebrow">Canonical memory</p><div><CircleDot size={12} /> Local / inspectable</div><div><ShieldCheck size={12} /> Approval gated</div></div>
    </aside>
  );
}

function SourcesView({ sources, selectedSource, setSelectedSourceId, onProcess }: { sources: SourceRecord[]; selectedSource: SourceRecord; setSelectedSourceId: (id: string) => void; onProcess: () => void }) {
  return (
    <div className="page-scroll sources-view">
      <section className="pipeline-section">
        <div className="section-heading"><div><p className="eyebrow">Universal processing pipeline</p><h2>One source. Two learning paths.</h2></div><p>Every output remains linked to source fragments, transformations, and feedback.</p></div>
        <div className="branch-pipeline">
          <div className="pipeline-node source-node"><FileText size={20} /><span>Sources</span><small>Local / web / paper</small></div>
          <div className="pipeline-arrow"><ArrowRight size={18} /></div>
          <div className="pipeline-node knowledge-node"><Sparkles size={20} /><span>Shared knowledge</span><small>Atoms / claims / evidence</small></div>
          <div className="branch-lines" aria-hidden="true"><i /><i /></div>
          <div className="branch-destinations">
            <div><UserRound size={19} /><span>Human learning</span><small>Lessons · exercises · reviews</small></div>
            <div><Bot size={19} /><span>Agent learning</span><small>Memory · skills · tools · plugins</small></div>
          </div>
          <div className="feedback-loop"><RefreshCw size={14} /> Application outcomes and feedback return as evidence</div>
        </div>
      </section>

      <section className="library-section">
        <div className="section-heading compact"><div><p className="eyebrow">Source library</p><h2>{sources.length} captured sources</h2></div><div className="search-box"><Search size={14} /><input aria-label="Search sources" placeholder="Search sources" /></div></div>
        <div className="source-workspace">
          <div className="source-list">
            <div className="source-list-head"><span>Source</span><span>Origin</span><span>Outputs</span><span>Status</span></div>
            {sources.map((source) => (
              <button key={source.id} className={selectedSource.id === source.id ? "selected" : ""} onClick={() => setSelectedSourceId(source.id)}>
                <div className="source-title"><SourceIcon origin={source.origin} /><span><strong>{source.title}</strong><small>{source.author}</small></span></div>
                <span>{source.format}</span>
                <span>{source.outputs.atoms} atoms / {source.outputs.lessons} lesson</span>
                <span className={`source-status ${source.status}`}><i />{source.status}</span>
              </button>
            ))}
          </div>
          <aside className="source-inspector">
            <p className="eyebrow">Selected source</p>
            <h3>{selectedSource.title}</h3>
            <p className="source-author">{selectedSource.author}</p>
            <dl><div><dt>Provenance</dt><dd>{selectedSource.provenance}</dd></div><div><dt>Added</dt><dd>{selectedSource.addedAt}</dd></div><div><dt>Processing</dt><dd>{selectedSource.progress}%</dd></div></dl>
            <div className="progress-track"><i style={{ width: `${selectedSource.progress}%` }} /></div>
            {selectedSource.status === "ready" ? (
              <div className="output-summary"><p><strong>{selectedSource.outputs.atoms}</strong><span>knowledge atoms</span></p><p><strong>{selectedSource.outputs.lessons}</strong><span>learning modules</span></p><p><strong>{selectedSource.outputs.capabilities}</strong><span>capabilities</span></p></div>
            ) : (
              <button className="primary-button full" onClick={onProcess}>{selectedSource.status === "processing" ? <><RefreshCw className="spin" size={15} /> Processing</> : <><Sparkles size={15} /> Process source</>}</button>
            )}
          </aside>
        </div>
      </section>
    </div>
  );
}

function SourceIcon({ origin }: { origin: SourceOrigin }) {
  if (origin === "web") return <Globe2 size={16} />;
  if (origin === "paper") return <BookOpen size={16} />;
  return <FileText size={16} />;
}

function LearnView() {
  const [selectedArtifact, setSelectedArtifact] = useState(learningArtifacts[0].id);
  const artifact = learningArtifacts.find((item) => item.id === selectedArtifact) ?? learningArtifacts[0];
  return (
    <div className="page-scroll learn-view">
      <section className="learning-header">
        <div><p className="eyebrow">Human learning state</p><h2>Current objective</h2><p>Explain the five density lenses, apply them to an unfamiliar interface, and separate preference from observed value.</p></div>
        <div className="learning-metrics"><p><span>Recall</span><strong>76%</strong></p><p><span>Application</span><strong>82%</strong></p><p><span>Transfer</span><strong>54%</strong></p></div>
      </section>
      <section className="artifact-workspace">
        <div className="artifact-list">
          <div className="section-heading compact"><div><p className="eyebrow">Generated artifacts</p><h2>Learning path</h2></div></div>
          {learningArtifacts.map((item, index) => (
            <button key={item.id} className={selectedArtifact === item.id ? "selected" : ""} onClick={() => setSelectedArtifact(item.id)}>
              <span className="artifact-index">0{index + 1}</span><span><small>{item.type}</small><strong>{item.title}</strong><i><b style={{ width: `${item.progress}%` }} /></i></span><span>{item.status}</span>
            </button>
          ))}
        </div>
        <div className="artifact-preview">
          <div className="preview-meta"><span>{artifact.type}</span><span>{artifact.evidence}</span></div>
          <p className="eyebrow">Active learning unit</p>
          <h2>{artifact.title}</h2>
          <p className="preview-lede">Generated from shared knowledge, then adapted using your prior responses, confidence, weak spots, and preferred working style.</p>
          <div className="lesson-sequence"><div><span>01</span><strong>Retrieve</strong><p>Explain without reopening the source.</p></div><div><span>02</span><strong>Apply</strong><p>Diagnose a new operational interface.</p></div><div><span>03</span><strong>Reflect</strong><p>Record uncertainty and revised understanding.</p></div></div>
          <button className="primary-button">Continue session <ArrowRight size={15} /></button>
        </div>
      </section>
    </div>
  );
}

function MemoryView({ events, theory, projections }: { events: EvidenceEvent[]; theory: LivingTheory; projections: MemoryProjections }) {
  const eventRows = useMemo(() => [...events].reverse(), [events]);
  return (
    <div className="page-scroll memory-view">
      <section className="memory-model">
        <div className="memory-column human-memory"><UserRound size={21} /><p className="eyebrow">Human state</p><h2>Understanding</h2><ul><li>{projections.human.theoryElementIds.length} shared theory references</li><li>{projections.human.contributedTheoryElementIds.length} human contributions</li><li>Recall and application evidence</li><li>Misconceptions and corrections</li></ul></div>
        <div className="shared-memory"><Network size={24} /><p className="eyebrow">Derived shared theory</p><h2>{theory.elements.length} theory elements</h2><p>{theory.title} links purpose, concepts, boundaries, questions, and revisions to the canonical evidence ledger.</p><div className="atom-cloud">{theory.elements.map((element) => <span key={element.id} title={element.id} className={`kind-border-${element.epistemicKind}`}>{element.title}</span>)}</div></div>
        <div className="memory-column agent-memory"><Bot size={21} /><p className="eyebrow">Agent state</p><h2>Capability</h2><ul><li>{projections.agent.theoryElementIds.length} shared theory references</li><li>{projections.agent.contributedTheoryElementIds.length} agent contributions</li><li>Evaluations and failures</li><li>Capability versions</li></ul></div>
      </section>
      <section className="ledger-section">
        <div className="section-heading compact"><div><p className="eyebrow">Append-only evidence ledger</p><h2>{events.length} recorded events</h2></div><button className="secondary-button"><History size={14} /> Consolidation proposals</button></div>
        <div className="ledger-head"><span>Time</span><span>Epistemic class</span><span>Event</span><span>Actor</span></div>
        {eventRows.map((event) => <article key={event.id}><time>{new Date(event.createdAt).toLocaleString([], { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</time><span className="ledger-kind"><i className={`kind-${event.kind}`} />{kindLabels[event.kind]}</span><div><strong>{event.type}</strong><p>{event.summary}</p></div><span>{event.actor}</span></article>)}
      </section>
    </div>
  );
}

function FoundryView() {
  const [selectedId, setSelectedId] = useState(capabilities[0].id);
  const capability = capabilities.find((item) => item.id === selectedId) ?? capabilities[0];
  const lifecycle = ["captured", "synthesized", "drafted", "sandboxed", "evaluated", "approved", "active"];
  return (
    <div className="page-scroll foundry-view">
      <section className="foundry-header"><div><p className="eyebrow">Agent capability state</p><h2>Knowledge becomes controlled action.</h2></div><p>Artifacts advance only through inspectable evidence, evaluation, and explicit human approval.</p></section>
      <section className="capability-workspace">
        <div className="capability-list"><div className="capability-head"><span>Artifact</span><span>Version</span><span>Status</span></div>{capabilities.map((item) => <button key={item.id} className={selectedId === item.id ? "selected" : ""} onClick={() => setSelectedId(item.id)}><span><small>{item.type}</small><strong>{item.name}</strong></span><span>{item.version}</span><span>{item.status}</span></button>)}</div>
        <div className="capability-detail"><div className="detail-title"><div><p className="eyebrow">{capability.type}</p><h2>{capability.name}</h2></div><span className="status-stamp">{capability.status}</span></div><div className="capability-stats"><p><strong>{capability.sources}</strong><span>sources</span></p><p><strong>{capability.evaluations}</strong><span>evaluations</span></p><p><strong>{capability.executions}</strong><span>executions</span></p></div><div className="lifecycle"><p className="eyebrow">Controlled evolution</p>{lifecycle.map((step, index) => { const reached = index <= lifecycle.indexOf(capability.status); return <div key={step} className={reached ? "reached" : ""}><i>{reached ? <Check size={11} /> : index + 1}</i><span>{step}</span></div>; })}</div><div className="foundry-actions"><button className="secondary-button"><ExternalLink size={14} /> Inspect artifact</button><button className="primary-button" disabled={capability.status !== "evaluated"}><ShieldCheck size={14} /> Approve activation</button></div></div>
      </section>
    </div>
  );
}

function AboutView() {
  return <div className="page-scroll about-view"><section className="about-statement"><p className="eyebrow">Learning Foundry</p><h2>A universal learning environment for people and their agents.</h2><p>Approved literature, papers, talks, documentation, and lived experience become source-grounded knowledge. That knowledge produces adaptive human learning and controlled agent capabilities. Application outcomes return as evidence so both can improve.</p></section><section className="about-columns"><div><span>01</span><h3>Ingest anything approved</h3><p>Local files and online sources enter through one provenance-preserving pipeline.</p></div><div><span>02</span><h3>Learn on both sides</h3><p>Human artifacts and agent memory derive from the same knowledge without collapsing into one state.</p></div><div><span>03</span><h3>Apply and revise</h3><p>Skills, tools, and plugins evolve through evaluation, execution feedback, and approval.</p></div></section></div>;
}

function AddSourceDialog({ mode, setMode, value, setValue, onClose, onAdd }: { mode: "url" | "local"; setMode: (mode: "url" | "local") => void; value: string; setValue: (value: string) => void; onClose: () => void; onAdd: () => void }) {
  return <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}><section className="source-dialog" role="dialog" aria-modal="true" aria-labelledby="add-source-title" onMouseDown={(event) => event.stopPropagation()}><div className="dialog-head"><div><p className="eyebrow">Source ingestion</p><h2 id="add-source-title">Add to the foundry</h2></div><button className="icon-button" title="Close" onClick={onClose}><X size={17} /></button></div><div className="mode-switch"><button className={mode === "url" ? "active" : ""} onClick={() => setMode("url")}><Link2 size={15} /> Online source</button><button className={mode === "local" ? "active" : ""} onClick={() => setMode("local")}><Upload size={15} /> Local file</button></div><label className="dialog-field"><span>{mode === "url" ? "Source URL" : "Local file path"}</span><input value={value} onChange={(event) => setValue(event.target.value)} placeholder={mode === "url" ? "https://example.org/paper" : "/Users/you/Documents/source.pdf"} /></label><div className="ingestion-note"><ShieldCheck size={17} /><p><strong>Nothing activates automatically.</strong><span>The source will be captured, checked, and processed into inspectable proposals.</span></p></div><button className="primary-button full" onClick={onAdd} disabled={!value.trim()}>Capture source <ArrowRight size={15} /></button></section></div>;
}

export default App;
