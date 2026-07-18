import { ArrowRight, BookOpen, Bot, FileText, Globe2, RefreshCw, Search, Sparkles, UserRound } from "lucide-react";
import type { SourceOrigin, SourceRecord } from "../domain/sourceProjection";

interface SourcesViewProps {
  sources: SourceRecord[];
  selectedSource: SourceRecord;
  setSelectedSourceId: (id: string) => void;
  onProcess: () => void;
}

export function SourcesView({ sources, selectedSource, setSelectedSourceId, onProcess }: SourcesViewProps) {
  return (
    <div className="page-scroll sources-view">
      <section className="pipeline-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Universal processing pipeline</p>
            <h2>One source. Two learning paths.</h2>
          </div>
          <p>Every output remains linked to source fragments, transformations, and feedback.</p>
        </div>
        <div className="branch-pipeline">
          <div className="pipeline-node source-node">
            <FileText size={20} />
            <span>Sources</span>
            <small>Local / web / paper</small>
          </div>
          <div className="pipeline-arrow">
            <ArrowRight size={18} />
          </div>
          <div className="pipeline-node knowledge-node">
            <Sparkles size={20} />
            <span>Shared knowledge</span>
            <small>Atoms / claims / evidence</small>
          </div>
          <div className="branch-lines" aria-hidden="true">
            <i />
            <i />
          </div>
          <div className="branch-destinations">
            <div>
              <UserRound size={19} />
              <span>Human learning</span>
              <small>Lessons · exercises · reviews</small>
            </div>
            <div>
              <Bot size={19} />
              <span>Agent learning</span>
              <small>Memory · skills · tools · plugins</small>
            </div>
          </div>
          <div className="feedback-loop">
            <RefreshCw size={14} /> Application outcomes and feedback return as evidence
          </div>
        </div>
      </section>

      <section className="library-section">
        <div className="section-heading compact">
          <div>
            <p className="eyebrow">Source library</p>
            <h2>{sources.length} captured sources</h2>
          </div>
          <div className="search-box">
            <Search size={14} />
            <input aria-label="Search sources" placeholder="Search sources" />
          </div>
        </div>
        <div className="source-workspace">
          <div className="source-list">
            <div className="source-list-head">
              <span>Source</span>
              <span>Origin</span>
              <span>Outputs</span>
              <span>Status</span>
            </div>
            {sources.map((source) => (
              <button
                type="button"
                key={source.id}
                className={selectedSource.id === source.id ? "selected" : ""}
                onClick={() => setSelectedSourceId(source.id)}
              >
                <div className="source-title">
                  <SourceIcon origin={source.origin} />
                  <span>
                    <strong>{source.title}</strong>
                    <small>{source.author}</small>
                  </span>
                </div>
                <span>{source.format}</span>
                <span>
                  {source.outputs.atoms} atoms / {source.outputs.lessons} lesson
                </span>
                <span className={`source-status ${source.status}`}>
                  <i />
                  {source.status}
                </span>
              </button>
            ))}
          </div>
          <aside className="source-inspector">
            <p className="eyebrow">Selected source</p>
            <h3>{selectedSource.title}</h3>
            <p className="source-author">{selectedSource.author}</p>
            <dl>
              <div>
                <dt>Provenance</dt>
                <dd>{selectedSource.provenance}</dd>
              </div>
              <div>
                <dt>Added</dt>
                <dd>{selectedSource.addedAt}</dd>
              </div>
              <div>
                <dt>Processing</dt>
                <dd>{selectedSource.progress}%</dd>
              </div>
            </dl>
            <div className="progress-track">
              <i style={{ width: `${selectedSource.progress}%` }} />
            </div>
            {selectedSource.status === "ready" ? (
              <div className="output-summary">
                <p>
                  <strong>{selectedSource.outputs.atoms}</strong>
                  <span>knowledge atoms</span>
                </p>
                <p>
                  <strong>{selectedSource.outputs.lessons}</strong>
                  <span>learning modules</span>
                </p>
                <p>
                  <strong>{selectedSource.outputs.capabilities}</strong>
                  <span>capabilities</span>
                </p>
              </div>
            ) : (
              <button type="button" className="primary-button full" onClick={onProcess}>
                {selectedSource.status === "processing" ? (
                  <>
                    <RefreshCw className="spin" size={15} /> Processing
                  </>
                ) : (
                  <>
                    <Sparkles size={15} /> Process source
                  </>
                )}
              </button>
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
