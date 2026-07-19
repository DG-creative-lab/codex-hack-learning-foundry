import type { EvidenceEvent } from "./types";
import { detectUnderstandingGaps, type UnderstandingGapDetectionInput } from "./understandingGapDetectors";
import {
  type UnderstandingGap,
  type UnderstandingGapProjection,
  understandingGapAnnotationPayloadSchema,
  understandingGapReviewPayloadSchema
} from "./understandingGapTypes";

export * from "./understandingGapTypes";

function requireGapSources(event: EvidenceEvent, gap: UnderstandingGap) {
  const requiredSourceIds = [...new Set(gap.evidence.flatMap((reference) => reference.sourceIds))];
  const missingSourceId = requiredSourceIds.find((sourceId) => !event.sourceIds.includes(sourceId));
  if (missingSourceId) {
    throw new Error(`Understanding-gap event ${event.id} is missing provenance for ${missingSourceId}`);
  }
}

function applyReviewEvents(gaps: UnderstandingGap[], events: EvidenceEvent[]): UnderstandingGap[] {
  const byId = new Map(gaps.map((gap) => [gap.id, gap]));
  for (const event of events) {
    if (event.type === "memory.understanding_gap_reviewed") {
      if (event.actor !== "human" || event.kind !== "user_interpretation") {
        throw new Error(`Understanding-gap review ${event.id} must be recorded as a human interpretation`);
      }
      const review = understandingGapReviewPayloadSchema.parse(event.payload);
      const gap = byId.get(review.gapId);
      if (!gap) continue;
      requireGapSources(event, gap);
      if (gap.review) throw new Error(`Understanding gap ${gap.id} has already been reviewed`);
      byId.set(gap.id, {
        ...gap,
        status: review.decision,
        review: { ...review, evidenceEventId: event.id, createdAt: event.createdAt }
      });
    }
    if (event.type === "memory.understanding_gap_annotated") {
      if (event.actor !== "human" || event.kind !== "user_interpretation") {
        throw new Error(`Understanding-gap annotation ${event.id} must be recorded as a human interpretation`);
      }
      const annotation = understandingGapAnnotationPayloadSchema.parse(event.payload);
      const gap = byId.get(annotation.gapId);
      if (!gap) continue;
      requireGapSources(event, gap);
      byId.set(gap.id, {
        ...gap,
        annotations: [...gap.annotations, { ...annotation, evidenceEventId: event.id, createdAt: event.createdAt }]
      });
    }
  }
  return [...byId.values()];
}

export function deriveUnderstandingGaps(input: UnderstandingGapDetectionInput): UnderstandingGapProjection {
  const levelRank = { priority: 0, attention: 1, notice: 2 } as const;
  const statusRank = { open: 0, confirmed: 1, dismissed: 2 } as const;
  const gaps = applyReviewEvents(detectUnderstandingGaps(input), input.events).sort(
    (left, right) =>
      statusRank[left.status] - statusRank[right.status] ||
      levelRank[left.level] - levelRank[right.level] ||
      left.title.localeCompare(right.title)
  );
  return {
    gaps,
    openCount: gaps.filter((gap) => gap.status === "open").length,
    confirmedCount: gaps.filter((gap) => gap.status === "confirmed").length,
    dismissedCount: gaps.filter((gap) => gap.status === "dismissed").length
  };
}
