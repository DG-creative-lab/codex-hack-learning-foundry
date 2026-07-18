import { describe, expect, it } from "vitest";
import type { EvidenceEvent } from "../domain/types";
import { browserLedgerKey, createBrowserEvidenceMemory, type LedgerStorage } from "./browserEvidenceMemory";

class MemoryStorage implements LedgerStorage {
  readonly values = new Map<string, string>();

  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

const runtimeEvent: EvidenceEvent = {
  id: "evt-runtime",
  type: "source.processing_started",
  kind: "practical_observation",
  createdAt: "2026-07-18T12:00:00.000Z",
  actor: "system",
  summary: "Processing started.",
  sourceIds: ["source-a"],
  payload: { sourceId: "source-a", progress: 42 }
};

describe("browser evidence memory", () => {
  it("loads valid runtime events", async () => {
    const storage = new MemoryStorage();
    storage.setItem(browserLedgerKey, JSON.stringify([runtimeEvent]));

    await expect(createBrowserEvidenceMemory(storage).load()).resolves.toEqual({
      events: [runtimeEvent],
      rejectedCount: 0
    });
  });

  it("quarantines malformed memory before clearing the active key", async () => {
    const storage = new MemoryStorage();
    storage.setItem(browserLedgerKey, "{truncated");

    await expect(createBrowserEvidenceMemory(storage, browserLedgerKey, () => 123).load()).resolves.toEqual({
      events: [],
      rejectedCount: 1
    });
    expect(storage.getItem(`${browserLedgerKey}-rejected-123`)).toBe("{truncated");
    expect(storage.getItem(browserLedgerKey)).toBeNull();
  });

  it("stores the complete runtime projection and clears it on reset", async () => {
    const storage = new MemoryStorage();
    const memory = createBrowserEvidenceMemory(storage);
    await memory.append(runtimeEvent, [runtimeEvent]);
    expect(storage.getItem(browserLedgerKey)).toBe(JSON.stringify([runtimeEvent]));

    await memory.reset();
    expect(storage.getItem(browserLedgerKey)).toBeNull();
  });
});
