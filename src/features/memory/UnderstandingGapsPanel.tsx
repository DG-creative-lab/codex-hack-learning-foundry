import { ArrowUpRight, Check, MessageSquareText, X } from "lucide-react";
import { useState } from "react";
import {
  UNDERSTANDING_GAP_LIMITS,
  type UnderstandingGapDestination,
  type UnderstandingGapProjection
} from "../../domain/understandingGaps";
import { ProjectionEvidenceList } from "./ProjectionEvidenceList";

interface UnderstandingGapsPanelProps {
  projection: UnderstandingGapProjection;
  onReview: (gapId: string, decision: "confirmed" | "dismissed") => Promise<void>;
  onAnnotate: (gapId: string, note: string) => Promise<void>;
  onIntervene: (destination: UnderstandingGapDestination) => void;
}

const kindLabels = {
  unexplained_decision: "Unexplained decision",
  stale_theory: "Stale theory",
  low_prediction_evidence: "Prediction evidence",
  low_transfer_evidence: "Transfer evidence",
  black_box_capability_revision: "Capability revision",
  unresolved_contradiction: "Contradiction",
  agent_only_dependency: "Agent-only dependency",
  micro_world_mismatch: "Micro-world mismatch"
} as const;

export function UnderstandingGapsPanel({ projection, onReview, onAnnotate, onIntervene }: UnderstandingGapsPanelProps) {
  const defaultId = projection.gaps.find((gap) => gap.status === "open")?.id ?? projection.gaps[0]?.id;
  const [selectedId, setSelectedId] = useState(defaultId);
  const [annotation, setAnnotation] = useState("");
  const [pending, setPending] = useState<"confirm" | "dismiss" | "annotate">();
  const [error, setError] = useState<string>();
  const selected = projection.gaps.find((gap) => gap.id === selectedId) ?? projection.gaps[0];

  async function execute(kind: "confirm" | "dismiss" | "annotate", action: () => Promise<void>) {
    if (pending) return false;
    setPending(kind);
    setError(undefined);
    try {
      await action();
      return true;
    } catch {
      setError("This signal evidence could not be recorded. Nothing was saved; please try again.");
      return false;
    } finally {
      setPending(undefined);
    }
  }

  async function submitAnnotation() {
    if (!selected || annotation.trim().length < 3) return;
    const saved = await execute("annotate", () => onAnnotate(selected.id, annotation));
    if (saved) setAnnotation("");
  }

  if (projection.gaps.length === 0) {
    return (
      <section className="understanding-gap-section">
        <header className="gap-section-heading">
          <div>
            <p className="eyebrow">Evidence-backed gap signals</p>
            <h2>No current signals</h2>
          </div>
          <p>No bounded detector currently identifies a review condition.</p>
        </header>
      </section>
    );
  }

  return (
    <section className="understanding-gap-section" aria-busy={Boolean(pending)}>
      <header className="gap-section-heading">
        <div>
          <p className="eyebrow">Evidence-backed gap signals</p>
          <h2>Make cognitive debt visible</h2>
        </div>
        <p>Qualitative workflow signals, not a cognitive score.</p>
      </header>

      <section className="gap-summary" aria-label="Understanding signal summary">
        <div>
          <strong>{projection.openCount}</strong>
          <span>Open</span>
        </div>
        <div>
          <strong>{projection.confirmedCount}</strong>
          <span>Confirmed</span>
        </div>
        <div>
          <strong>{projection.dismissedCount}</strong>
          <span>Dismissed</span>
        </div>
      </section>

      <div className="gap-inspection-grid">
        <section className="gap-register" aria-label="Understanding gap signals">
          <header>
            <span>Signal</span>
            <span>Level</span>
            <span>Status</span>
          </header>
          {projection.gaps.map((gap) => (
            <button
              type="button"
              key={gap.id}
              className={gap.id === selected?.id ? "selected" : ""}
              onClick={() => {
                setSelectedId(gap.id);
                setAnnotation("");
                setError(undefined);
              }}
            >
              <span>
                <small>{kindLabels[gap.kind]}</small>
                <strong>{gap.title}</strong>
              </span>
              <span data-gap-level={gap.level}>{gap.level}</span>
              <span data-gap-status={gap.status}>{gap.status}</span>
            </button>
          ))}
        </section>

        {selected && (
          <aside className="gap-inspector">
            <div className="gap-inspector-heading">
              <p className="eyebrow">Selected signal / {kindLabels[selected.kind]}</p>
              <h3>{selected.title}</h3>
              <p>{selected.why}</p>
              <dl>
                <div>
                  <dt>Level</dt>
                  <dd data-gap-level={selected.level}>{selected.level}</dd>
                </div>
                <div>
                  <dt>Reason</dt>
                  <dd>{selected.severityRationale}</dd>
                </div>
                <div>
                  <dt>Affected theory</dt>
                  <dd>{selected.affectedTheoryElementIds.join(", ") || "Capability-level signal"}</dd>
                </div>
              </dl>
              <p className="gap-caveat">{selected.caveat}</p>
            </div>

            <ProjectionEvidenceList
              title="Linked evidence"
              references={selected.evidence}
              emptyLabel="No linked evidence is available."
              tone="mixed"
            />

            <section className="gap-intervention">
              <p className="eyebrow">Recommended intervention</p>
              <button type="button" onClick={() => onIntervene(selected.recommendedIntervention.destination)}>
                <span>{selected.recommendedIntervention.label}</span>
                <ArrowUpRight size={15} aria-hidden="true" />
              </button>
            </section>

            {selected.review ? (
              <section className="gap-review-state">
                <span data-gap-status={selected.status}>{selected.status}</span>
                <p>{selected.review.reason || "Review state recorded without an additional note."}</p>
                <code>{selected.review.evidenceEventId}</code>
              </section>
            ) : (
              <div className="gap-review-actions">
                <button
                  type="button"
                  disabled={Boolean(pending)}
                  onClick={() => void execute("confirm", () => onReview(selected.id, "confirmed"))}
                >
                  <Check size={14} aria-hidden="true" /> {pending === "confirm" ? "Recording..." : "Confirm"}
                </button>
                <button
                  type="button"
                  disabled={Boolean(pending)}
                  onClick={() => void execute("dismiss", () => onReview(selected.id, "dismissed"))}
                >
                  <X size={14} aria-hidden="true" /> {pending === "dismiss" ? "Recording..." : "Dismiss"}
                </button>
              </div>
            )}

            <section className="gap-annotation">
              <label htmlFor={`gap-annotation-${selected.id}`}>Correction or context</label>
              <textarea
                id={`gap-annotation-${selected.id}`}
                value={annotation}
                maxLength={UNDERSTANDING_GAP_LIMITS.annotationCharacters}
                rows={3}
                disabled={Boolean(pending)}
                onChange={(event) => setAnnotation(event.target.value)}
              />
              <div>
                <span>
                  {annotation.length} / {UNDERSTANDING_GAP_LIMITS.annotationCharacters}
                </span>
                <button
                  type="button"
                  disabled={annotation.trim().length < 3 || Boolean(pending)}
                  onClick={() => void submitAnnotation()}
                >
                  <MessageSquareText size={14} aria-hidden="true" />
                  {pending === "annotate" ? "Recording..." : "Add annotation"}
                </button>
              </div>
            </section>
            {error && (
              <p className="gap-command-error" role="alert">
                {error}
              </p>
            )}

            {selected.annotations.length > 0 && (
              <section className="gap-annotation-history">
                <h4>Recorded context</h4>
                {selected.annotations.map((item) => (
                  <article key={item.evidenceEventId}>
                    <p>{item.note}</p>
                    <code>{item.evidenceEventId}</code>
                  </article>
                ))}
              </section>
            )}
          </aside>
        )}
      </div>
    </section>
  );
}
