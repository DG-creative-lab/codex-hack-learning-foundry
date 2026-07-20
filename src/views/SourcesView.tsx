import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Bot,
  Check,
  FileText,
  Globe2,
  MapPin,
  RefreshCw,
  Search,
  Sparkles,
  UserRound
} from "lucide-react";
import { UnderstandingContextBar } from "../components/UnderstandingContextBar";
import type { NormalizedSourceFragment, SourceSynthesisProposal } from "../domain/sourcePipeline";
import type { SourceOrigin, SourceRecord } from "../domain/sourceProjection";

interface SourcesViewProps {
  sources: SourceRecord[];
  selectedSource: SourceRecord;
  fragments: NormalizedSourceFragment[];
  proposals: SourceSynthesisProposal[];
  setSelectedSourceId: (id: string) => void;
  onProcess: () => void;
  onApprove: (proposalId: string) => void;
  onReject: (proposalId: string) => void;
  contextTitle?: string;
  onReturnToTheory?: () => void;
}

export function SourcesView({
  sources,
  selectedSource,
  fragments,
  proposals,
  setSelectedSourceId,
  onProcess,
  onApprove,
  onReject,
  contextTitle,
  onReturnToTheory
}: SourcesViewProps) {
  const selectedFragments = fragments.filter((fragment) => fragment.versionId === selectedSource.currentVersionId);
  const proposal = proposals.find(
    (candidate) => candidate.sourceId === selectedSource.id && candidate.versionId === selectedSource.currentVersionId
  );

  return (
    <div className="page-scroll sources-view">
      {onReturnToTheory && (
        <UnderstandingContextBar contextTitle={contextTitle ?? "Living Theory"} onReturnToTheory={onReturnToTheory} />
      )}
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
            {selectedSource.error && (
              <div className="source-error" role="alert">
                <AlertTriangle size={15} />
                <p>
                  <strong>{selectedSource.error.code.replaceAll("_", " ")}</strong>
                  <span>{selectedSource.error.message}</span>
                </p>
              </div>
            )}
            {proposal ? (
              <div className="synthesis-review">
                <div className="review-heading">
                  <span>Living Theory proposal</span>
                  <strong>{proposal.status}</strong>
                </div>
                <p>
                  {proposal.elements.length} elements · {proposal.relationships.length} relationships
                </p>
                <div className="candidate-list">
                  {proposal.elements.slice(0, 5).map((candidate) => {
                    const fragment = selectedFragments.find((item) => candidate.element.fragmentIds.includes(item.id));
                    return (
                      <details key={candidate.id}>
                        <summary>
                          <span>{candidate.element.kind.replaceAll("_", " ")}</span>
                          <strong>{Math.round(candidate.confidence * 100)}%</strong>
                        </summary>
                        <p>{candidate.element.statement}</p>
                        {fragment && (
                          <blockquote>
                            <span>
                              <MapPin size={11} /> {fragment.location.label}
                            </span>
                            {fragment.content}
                          </blockquote>
                        )}
                        {candidate.reviewReason && <small>{candidate.reviewReason}</small>}
                      </details>
                    );
                  })}
                  {proposal.relationships.slice(0, 3).map((candidate) => {
                    const supportingFragments = selectedFragments.filter((fragment) =>
                      candidate.relationship.fragmentIds.includes(fragment.id)
                    );
                    return (
                      <details key={candidate.id}>
                        <summary>
                          <span>relation · {candidate.relationship.kind}</span>
                          <strong>{Math.round(candidate.confidence * 100)}%</strong>
                        </summary>
                        <p>
                          {candidate.relationship.fromElementId} -&gt; {candidate.relationship.toElementId}
                        </p>
                        {supportingFragments.map((fragment) => (
                          <blockquote key={fragment.id}>
                            <span>
                              <MapPin size={11} /> {fragment.location.label}
                            </span>
                            {fragment.content}
                          </blockquote>
                        ))}
                        {candidate.reviewReason && <small>{candidate.reviewReason}</small>}
                      </details>
                    );
                  })}
                </div>
                {proposal.status === "pending" && (
                  <div className="review-actions">
                    <button type="button" className="text-button" onClick={() => onReject(proposal.id)}>
                      Reject
                    </button>
                    <button type="button" className="primary-button" onClick={() => onApprove(proposal.id)}>
                      <Check size={15} /> Approve into theory
                    </button>
                  </div>
                )}
              </div>
            ) : selectedSource.status === "ready" ? (
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
                    <Sparkles size={15} /> {selectedSource.status === "failed" ? "Retry extraction" : "Process source"}
                  </>
                )}
              </button>
            )}
            {selectedSource.status === "ready" &&
              selectedSource.currentVersionId &&
              (selectedSource.origin === "web" || selectedSource.provenance.startsWith("/")) && (
                <button type="button" className="text-button reprocess-button" onClick={onProcess}>
                  <RefreshCw size={13} /> Check for source changes
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
