import { describe, expect, it } from "vitest";
import { seedEvents } from "../data/sample";
import { workspaceSources } from "../data/workspace";
import type { EvidenceEvent } from "./types";
import { deriveSources, type SourceRecord } from "./sourceProjection";

const capturedSource: SourceRecord = {
  id: "source-runtime",
  title: "Runtime source",
  author: "Pending extraction",
  origin: "web",
  format: "Web page",
  status: "queued",
  progress: 0,
  addedAt: "Just now",
  provenance: "https://example.com/source",
  outputs: { atoms: 0, lessons: 0, capabilities: 0 }
};

function event(type: string, payload: Record<string, unknown>): EvidenceEvent {
  return {
    id: `evt-${type}`,
    type,
    kind: "practical_observation",
    createdAt: "2026-07-18T12:00:00.000Z",
    actor: "system",
    summary: type,
    sourceIds: [capturedSource.id],
    payload
  };
}

describe("source projection", () => {
  it("derives the prepared workspace entirely from seed events", () => {
    expect(deriveSources(seedEvents)).toEqual([...workspaceSources].reverse());
  });

  it("replays a captured source through processing to completion", () => {
    const events = [
      ...seedEvents,
      event("source.registered", { source: capturedSource }),
      event("source.processing_started", { sourceId: capturedSource.id, progress: 42 }),
      event("source.processing_completed", {
        sourceId: capturedSource.id,
        author: "Extracted source",
        outputs: { atoms: 7, lessons: 1, capabilities: 0 }
      })
    ];

    expect(deriveSources(events)[0]).toMatchObject({
      id: capturedSource.id,
      status: "ready",
      progress: 100,
      author: "Extracted source",
      outputs: { atoms: 7, lessons: 1, capabilities: 0 }
    });
  });

  it("rejects lifecycle events for unknown sources", () => {
    const unknownSourceEvent = event("source.processing_started", { sourceId: "source-unknown", progress: 42 });
    unknownSourceEvent.sourceIds = ["source-unknown"];
    expect(() => deriveSources([unknownSourceEvent])).toThrow("Cannot process unknown source source-unknown");
  });
});
