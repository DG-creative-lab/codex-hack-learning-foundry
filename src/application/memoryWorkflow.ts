import type { EvidenceEvent } from "../domain/types";
import {
  type UnderstandingGap,
  type UnderstandingGapReview,
  understandingGapAnnotationPayloadSchema,
  understandingGapReviewPayloadSchema
} from "../domain/understandingGaps";

interface MemoryWorkflowDependencies {
  append: (event: EvidenceEvent) => Promise<unknown>;
  resolveGap: (gapId: string) => UnderstandingGap | undefined;
  now?: () => string;
  createId?: (prefix: string) => string;
}

function defaultId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function sourceIdsFor(gap: UnderstandingGap): string[] {
  return [...new Set(gap.evidence.flatMap((reference) => reference.sourceIds))];
}

export function createMemoryWorkflow(dependencies: MemoryWorkflowDependencies) {
  const now = dependencies.now ?? (() => new Date().toISOString());
  const createId = dependencies.createId ?? defaultId;

  async function reviewUnderstandingGap(gapId: string, decision: UnderstandingGapReview["decision"], reason?: string) {
    const gap = dependencies.resolveGap(gapId);
    if (!gap) throw new Error(`Cannot review unknown understanding gap ${gapId}`);
    if (gap.status !== "open") throw new Error(`Understanding gap ${gapId} has already been reviewed`);
    const payload = understandingGapReviewPayloadSchema.parse({ gapId, decision, reason });
    const event: EvidenceEvent = {
      id: createId("evt-understanding-gap-review"),
      type: "memory.understanding_gap_reviewed",
      kind: "user_interpretation",
      createdAt: now(),
      actor: "human",
      summary: `${decision === "confirmed" ? "Confirmed" : "Dismissed"} understanding signal: ${gap.title}.`,
      sourceIds: sourceIdsFor(gap),
      payload
    };
    await dependencies.append(event);
  }

  async function annotateUnderstandingGap(gapId: string, note: string) {
    const gap = dependencies.resolveGap(gapId);
    if (!gap) throw new Error(`Cannot annotate unknown understanding gap ${gapId}`);
    const payload = understandingGapAnnotationPayloadSchema.parse({ gapId, note });
    const event: EvidenceEvent = {
      id: createId("evt-understanding-gap-annotation"),
      type: "memory.understanding_gap_annotated",
      kind: "user_interpretation",
      createdAt: now(),
      actor: "human",
      summary: `Added context to understanding signal: ${gap.title}.`,
      sourceIds: sourceIdsFor(gap),
      payload
    };
    await dependencies.append(event);
  }

  return { reviewUnderstandingGap, annotateUnderstandingGap };
}

export type MemoryWorkflow = ReturnType<typeof createMemoryWorkflow>;
