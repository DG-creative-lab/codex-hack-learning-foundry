import { Ban, Check, CornerDownRight, RefreshCw, Sparkles } from "lucide-react";
import type { ProjectedReviewItem, UnderstandingCheckProjection } from "../../domain/understandingChecks";
import type { SourceIndex } from "./types";

interface UnderstandingCheckInspectorProps {
  check: UnderstandingCheckProjection;
  reviewItems: ProjectedReviewItem[];
  sourcesById: SourceIndex;
  pending: boolean;
  saved?: string;
  onPreference: (preference: "more_like_this" | "different_angle" | "reject") => void;
}

export function UnderstandingCheckInspector({
  check,
  reviewItems,
  sourcesById,
  pending,
  saved,
  onPreference
}: UnderstandingCheckInspectorProps) {
  return (
    <aside className="check-inspector">
      <section>
        <p className="eyebrow">Targeted review</p>
        {reviewItems.length > 0 ? (
          reviewItems.map((item) => (
            <article key={`${item.attemptEventId}:${item.id}`}>
              <CornerDownRight size={14} />
              <div>
                <strong>{item.title}</strong>
                <p>{item.prompt}</p>
                <div className="review-provenance">
                  {item.sourceIds.map((sourceId) => (
                    <span key={sourceId}>{sourcesById.get(sourceId)?.title ?? sourceId}</span>
                  ))}
                </div>
              </div>
            </article>
          ))
        ) : (
          <p>No active review item for this check.</p>
        )}
      </section>
      <section className="check-steering">
        <p className="eyebrow">Future checks</p>
        <button
          type="button"
          aria-pressed={check.preference?.preference === "more_like_this"}
          disabled={pending || check.status === "rejected"}
          onClick={() => onPreference("more_like_this")}
        >
          <Sparkles size={14} /> More like this
        </button>
        <button
          type="button"
          aria-pressed={check.preference?.preference === "different_angle"}
          disabled={pending || check.status === "rejected"}
          onClick={() => onPreference("different_angle")}
        >
          <RefreshCw size={14} /> Different angle
        </button>
        <button
          type="button"
          aria-pressed={check.preference?.preference === "reject"}
          disabled={pending || check.status === "rejected"}
          onClick={() => onPreference("reject")}
        >
          <Ban size={14} /> Reject pattern
        </button>
        {saved && (
          <p className="feedback-saved">
            <Check size={12} /> Evidence appended
          </p>
        )}
      </section>
    </aside>
  );
}
