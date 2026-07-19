import { describe, expect, it, vi } from "vitest";
import type { ExtractedSourceDocument } from "../domain/sourcePipeline";
import type { SourceRecord } from "../domain/sourceProjection";
import type { EvidenceEvent } from "../domain/types";
import type { WorkspaceProjection } from "../domain/workspaceProjection";
import { createSourceWorkflow } from "./sourceWorkflow";

const createdAt = "2026-07-19T10:00:00.000Z";

function source(overrides: Partial<SourceRecord> = {}): SourceRecord {
  return {
    id: "source-1",
    title: "Design notes",
    author: "Pending extraction",
    origin: "web",
    format: "Web page",
    status: "queued",
    progress: 0,
    addedAt: "Just now",
    provenance: "https://example.com/notes",
    outputs: { atoms: 0, lessons: 0, capabilities: 0 },
    ...overrides
  };
}

function document(): ExtractedSourceDocument {
  return {
    title: "Design notes",
    author: "Ada",
    format: "Web page",
    fingerprint: "a".repeat(64),
    units: [
      {
        content: "Useful interfaces preserve meaningful context because context supports decisions.",
        location: { kind: "web", label: "Block 1", url: "https://example.com/notes" }
      }
    ]
  };
}

function workspace(proposals: WorkspaceProjection["synthesisProposals"] = []): WorkspaceProjection {
  return { synthesisProposals: proposals } as WorkspaceProjection;
}

function harness(extract = vi.fn().mockResolvedValue({ ok: true, document: document() })) {
  const events: EvidenceEvent[] = [];
  let sequence = 0;
  const workflow = createSourceWorkflow({
    append: async (event) => {
      events.push(event);
    },
    extract,
    now: () => createdAt,
    createId: (prefix) => `${prefix}-${++sequence}`
  });
  return { events, extract, workflow };
}

describe("source workflow", () => {
  it("registers a normalized source through one application command", async () => {
    const { events, workflow } = harness();

    const sourceId = await workflow.register("url", "  https://example.com/notes  ");

    expect(sourceId).toBe("source-1");
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "source.registered",
      sourceIds: ["source-1"],
      payload: { source: { title: "example.com", provenance: "https://example.com/notes" } }
    });
  });

  it("owns extraction and synthesis event sequencing outside the UI", async () => {
    const { events, extract, workflow } = harness();

    await workflow.process(source(), workspace());

    expect(extract).toHaveBeenCalledWith({ origin: "web", provenance: "https://example.com/notes" });
    expect(events.map((event) => event.type)).toEqual(["source.processing_started", "source.synthesis_completed"]);
    expect(events[1].payload).toMatchObject({
      sourceId: "source-1",
      outputs: { atoms: 1 },
      proposal: { status: "pending" }
    });
  });

  it("records extraction failures without leaking coordination into the view", async () => {
    const extract = vi.fn().mockResolvedValue({
      ok: false,
      error: { code: "fetch_failed", message: "Could not fetch source.", retryable: true }
    });
    const { events, workflow } = harness(extract);

    await workflow.process(source(), workspace());

    expect(events.map((event) => event.type)).toEqual(["source.processing_started", "source.processing_failed"]);
    expect(events[1].payload).toMatchObject({ sourceId: "source-1", error: { code: "fetch_failed" } });
  });

  it("records an unchanged extraction without creating another proposal", async () => {
    const { events, workflow } = harness();

    await workflow.process(source({ currentVersionId: "source-1-v-aaaaaaaaaaaa" }), workspace());

    expect(events.map((event) => event.type)).toEqual(["source.processing_started", "source.processing_completed"]);
  });

  it("reviews only pending proposals", async () => {
    const { events: synthesisEvents, workflow } = harness();
    await workflow.process(source(), workspace());
    const proposal = synthesisEvents[1].payload.proposal as WorkspaceProjection["synthesisProposals"][number];

    const reviewHarness = harness();
    await reviewHarness.workflow.review(proposal.id, "approved", workspace([proposal]));
    await reviewHarness.workflow.review(proposal.id, "approved", workspace([{ ...proposal, status: "approved" }]));

    expect(reviewHarness.events).toHaveLength(1);
    expect(reviewHarness.events[0]).toMatchObject({
      type: "theory.synthesis_reviewed",
      payload: { proposalId: proposal.id, decision: "approved" }
    });
  });
});
