import { describe, expect, it } from "vitest";
import type { EvidenceEvent } from "../domain/types";
import { browserLedgerKey, createBrowserEvidenceMemory, type LedgerStorage } from "./browserEvidenceMemory";

class MemoryStorage implements LedgerStorage {
  readonly values = new Map<string, string>();
  readonly writes: string[] = [];

  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.writes.push(key); this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

function runtimeEvent(id = "evt-runtime"): EvidenceEvent {
  return {
    id,
    type: "source.processing_started",
    kind: "practical_observation",
    createdAt: "2026-07-18T12:00:00.000Z",
    actor: "system",
    summary: "Processing started.",
    sourceIds: ["source-a"],
    payload: { sourceId: "source-a", progress: 42 }
  };
}

describe("browser evidence memory", () => {
  it("migrates the legacy array into an append-only journal", async () => {
    const storage = new MemoryStorage();
    storage.setItem(browserLedgerKey, JSON.stringify([runtimeEvent()]));

    await expect(createBrowserEvidenceMemory(storage).load()).resolves.toEqual({
      events: [runtimeEvent()],
      rejectedCount: 0
    });
    expect(storage.getItem(browserLedgerKey)).toBeNull();
    expect(storage.getItem(`${browserLedgerKey}:g0:0`)).toBe(JSON.stringify(runtimeEvent()));
    expect(storage.getItem(`${browserLedgerKey}:meta`)).toBe(JSON.stringify({ version: 1, generation: 0, length: 1 }));
  });

  it("quarantines malformed legacy memory before clearing it", async () => {
    const storage = new MemoryStorage();
    storage.setItem(browserLedgerKey, "{truncated");

    await expect(createBrowserEvidenceMemory(storage, browserLedgerKey, () => 123).load()).resolves.toEqual({
      events: [],
      rejectedCount: 1
    });
    expect(storage.getItem(`${browserLedgerKey}-rejected-123-legacy`)).toBe("{truncated");
    expect(storage.getItem(browserLedgerKey)).toBeNull();
  });

  it("appends one event without rewriting prior event payloads", async () => {
    const storage = new MemoryStorage();
    const memory = createBrowserEvidenceMemory(storage);
    const first = runtimeEvent("evt-first");
    const second = runtimeEvent("evt-second");
    await memory.append(first);
    storage.writes.length = 0;

    await memory.append(second);
    expect(storage.writes).toEqual([`${browserLedgerKey}:g0:1`, `${browserLedgerKey}:meta`]);
    await expect(memory.load()).resolves.toEqual({ events: [first, second], rejectedCount: 0 });
  });

  it("quarantines a malformed entry and compacts valid records", async () => {
    const storage = new MemoryStorage();
    const memory = createBrowserEvidenceMemory(storage, browserLedgerKey, () => 456);
    const first = runtimeEvent("evt-first");
    const second = runtimeEvent("evt-second");
    await memory.append(first);
    await memory.append(second);
    storage.setItem(`${browserLedgerKey}:g0:0`, "{damaged");

    await expect(memory.load()).resolves.toEqual({ events: [second], rejectedCount: 1 });
    expect(storage.getItem(`${browserLedgerKey}-rejected-456-g0-0`)).toBe("{damaged");
    expect(storage.getItem(`${browserLedgerKey}:g0:0`)).toBeNull();
    expect(storage.getItem(`${browserLedgerKey}:g1:0`)).toBe(JSON.stringify(second));
  });

  it("clears active journal entries on reset", async () => {
    const storage = new MemoryStorage();
    const memory = createBrowserEvidenceMemory(storage);
    const event = runtimeEvent();
    await memory.append(event);

    await memory.reset();
    expect(storage.getItem(`${browserLedgerKey}:meta`)).toBeNull();
    expect(storage.getItem(`${browserLedgerKey}:g0:0`)).toBeNull();
  });
});
