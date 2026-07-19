import type { MemoryEvidenceReference, MemoryFreshness } from "./memoryProjectionTypes";
import type { EvidenceEvent } from "./types";
import type { UnderstandingSignal } from "./understandingChecks";

const STALE_AFTER_MILLISECONDS = 30 * 24 * 60 * 60 * 1000;

export function latestTimestamp(values: string[]): string | undefined {
  return values.reduce<string | undefined>((latest, value) => (!latest || value > latest ? value : latest), undefined);
}

export function memoryFreshness(lastObservedAt: string | undefined, asOf: string): MemoryFreshness {
  if (!lastObservedAt) return "unobserved";
  return Date.parse(asOf) - Date.parse(lastObservedAt) > STALE_AFTER_MILLISECONDS ? "stale" : "current";
}

export function evidenceReference(
  event: EvidenceEvent,
  signal: UnderstandingSignal,
  rationale: string
): MemoryEvidenceReference {
  return {
    eventId: event.id,
    createdAt: event.createdAt,
    kind: event.kind,
    summary: event.summary,
    sourceIds: event.sourceIds,
    signal,
    rationale
  };
}

export function uniqueEvidence(references: MemoryEvidenceReference[]): MemoryEvidenceReference[] {
  return [...new Map(references.map((reference) => [reference.eventId, reference])).values()];
}
