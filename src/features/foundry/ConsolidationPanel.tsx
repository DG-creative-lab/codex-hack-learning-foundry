import { Check, GitMerge, X } from "lucide-react";
import { useState } from "react";
import { CONSOLIDATION_LIMITS, type ConsolidationProposalProjection } from "../../domain/consolidation";

export interface ConsolidationCandidate {
  eventId: string;
  label: string;
  kind: string;
  createdAt: string;
}

interface ConsolidationPanelProps {
  candidates: ConsolidationCandidate[];
  proposals: ConsolidationProposalProjection[];
  onPropose: (triggerEventIds: string[]) => Promise<string>;
  onReview: (proposalId: string, decision: "approved" | "rejected", reason: string) => Promise<void>;
}

export function ConsolidationPanel({ candidates, proposals, onPropose, onReview }: ConsolidationPanelProps) {
  const [reviewReasons, setReviewReasons] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<string>();
  const [error, setError] = useState<string>();

  async function execute(key: string, command: () => Promise<unknown>) {
    setPending(key);
    setError(undefined);
    try {
      await command();
    } catch (commandError) {
      setError(commandError instanceof Error ? commandError.message : String(commandError));
    } finally {
      setPending(undefined);
    }
  }

  if (candidates.length === 0 && proposals.length === 0) return null;

  return (
    <section className="foundry-consolidation" aria-labelledby="consolidation-title">
      <header>
        <div>
          <p className="eyebrow">Consolidation queue</p>
          <h3 id="consolidation-title">Evidence can propose change, not enact it</h3>
        </div>
        <span>{proposals.filter((proposal) => proposal.status === "pending").length} pending</span>
      </header>

      {candidates.length > 0 && (
        <div className="consolidation-candidates">
          {candidates.map((candidate) => (
            <article key={candidate.eventId}>
              <div>
                <small>{candidate.kind}</small>
                <strong>{candidate.label}</strong>
                <code>{candidate.eventId}</code>
              </div>
              <button
                type="button"
                className="secondary-button"
                disabled={pending !== undefined}
                onClick={() => void execute(candidate.eventId, () => onPropose([candidate.eventId]))}
              >
                <GitMerge size={15} /> {pending === candidate.eventId ? "Proposing..." : "Propose consolidation"}
              </button>
            </article>
          ))}
        </div>
      )}

      {proposals.map((proposal) => (
        <article className="consolidation-proposal" key={proposal.id} data-status={proposal.status}>
          <header>
            <div>
              <small>{proposal.status}</small>
              <strong>{proposal.rationale}</strong>
            </div>
            <code>{proposal.id}</code>
          </header>
          <dl>
            <div>
              <dt>Review items</dt>
              <dd>{proposal.reviewItems.length}</dd>
            </div>
            <div>
              <dt>Theory revisions</dt>
              <dd>{proposal.theoryRevisions.length}</dd>
            </div>
            <div>
              <dt>Capability requests</dt>
              <dd>{proposal.capabilityRevisionRequests.length}</dd>
            </div>
          </dl>
          {proposal.theoryRevisions.map((revision) => (
            <p key={revision.id}>
              <strong>{revision.title}</strong>
              <span>{revision.statement}</span>
            </p>
          ))}
          {proposal.capabilityRevisionRequests.map((request) => (
            <p key={request.id}>
              <strong>
                Revision request for {request.capabilityId} / {request.capabilityVersion}
              </strong>
              <span>{request.requestedChanges}</span>
            </p>
          ))}
          {proposal.status === "pending" && (
            <div className="consolidation-review">
              <label htmlFor={`consolidation-reason-${proposal.id}`}>Human review rationale</label>
              <textarea
                id={`consolidation-reason-${proposal.id}`}
                value={reviewReasons[proposal.id] ?? ""}
                maxLength={CONSOLIDATION_LIMITS.rationaleCharacters}
                onChange={(event) => setReviewReasons((current) => ({ ...current, [proposal.id]: event.target.value }))}
              />
              {error && <p role="alert">{error}</p>}
              <div>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={(reviewReasons[proposal.id] ?? "").trim().length < 3 || pending !== undefined}
                  onClick={() =>
                    void execute(`reject:${proposal.id}`, () =>
                      onReview(proposal.id, "rejected", reviewReasons[proposal.id] ?? "")
                    )
                  }
                >
                  <X size={15} /> {pending === `reject:${proposal.id}` ? "Recording..." : "Reject proposal"}
                </button>
                <button
                  type="button"
                  className="primary-button"
                  disabled={(reviewReasons[proposal.id] ?? "").trim().length < 3 || pending !== undefined}
                  onClick={() =>
                    void execute(`approve:${proposal.id}`, () =>
                      onReview(proposal.id, "approved", reviewReasons[proposal.id] ?? "")
                    )
                  }
                >
                  <Check size={15} /> {pending === `approve:${proposal.id}` ? "Recording..." : "Approve revisions"}
                </button>
              </div>
            </div>
          )}
          {proposal.review && <p className="consolidation-decision">{proposal.review.reason}</p>}
        </article>
      ))}
    </section>
  );
}
