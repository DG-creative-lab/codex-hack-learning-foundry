import { describe, expect, it } from "vitest";
import { seedEvents } from "../data/sample";
import type { EvidenceEvent } from "../domain/types";
import { reduceWorkspace } from "../domain/workspaceProjection";
import { createMemoryWorkflow } from "./memoryWorkflow";

describe("memory workflow", () => {
  it("records bounded reviews and annotations against the canonical gap", async () => {
    const gap = reduceWorkspace(seedEvents).understandingGaps.gaps[0];
    if (!gap) throw new Error("Prepared understanding gap is missing");
    const events: EvidenceEvent[] = [];
    const workflow = createMemoryWorkflow({
      append: async (event) => events.push(event),
      resolveGap: (gapId) => (gapId === gap.id ? gap : undefined),
      now: () => "2026-07-19T18:00:00.000Z",
      createId: (prefix) => `${prefix}-${events.length + 1}`
    });

    await workflow.reviewUnderstandingGap(gap.id, "confirmed", "This signal affects the active work.");
    await workflow.annotateUnderstandingGap(gap.id, "Use the prepared intervention before capability activation.");

    expect(events.map((event) => event.type)).toEqual([
      "memory.understanding_gap_reviewed",
      "memory.understanding_gap_annotated"
    ]);
    expect(events.every((event) => event.actor === "human" && event.kind === "user_interpretation")).toBe(true);
    expect(
      events.every((event) =>
        event.sourceIds.every((sourceId) => gap.evidence.some((item) => item.sourceIds.includes(sourceId)))
      )
    ).toBe(true);
  });

  it("rejects unknown, already-reviewed, and oversized gap commands before append", async () => {
    const original = reduceWorkspace(seedEvents).understandingGaps.gaps[0];
    if (!original) throw new Error("Prepared understanding gap is missing");
    const reviewed = { ...original, status: "dismissed" as const };
    const events: EvidenceEvent[] = [];
    let gap = original;
    const workflow = createMemoryWorkflow({
      append: async (event) => events.push(event),
      resolveGap: (gapId) => (gapId === gap.id ? gap : undefined)
    });

    await expect(workflow.reviewUnderstandingGap("missing", "confirmed")).rejects.toThrow("unknown");
    gap = reviewed;
    await expect(workflow.reviewUnderstandingGap(gap.id, "confirmed")).rejects.toThrow("already been reviewed");
    await expect(workflow.annotateUnderstandingGap(gap.id, "x".repeat(1201))).rejects.toThrow();
    expect(events).toHaveLength(0);
  });
});
