import { describe, expect, it } from "vitest";
import type { EvidenceEvent } from "../domain/types";
import { EvidenceLedger, type EvidenceMemory, type StoredEvents } from "./evidenceLedger";

const seedEvent = makeEvent("evt-seed");

function makeEvent(id: string): EvidenceEvent {
  return {
    id,
    type: "source.processing_started",
    kind: "practical_observation",
    createdAt: "2026-07-18T12:00:00.000Z",
    actor: "system",
    summary: `Recorded ${id}.`,
    sourceIds: ["source-a"],
    payload: { sourceId: "source-a", progress: 42 }
  };
}

function memory(overrides: Partial<EvidenceMemory> = {}): EvidenceMemory {
  return {
    load: async (): Promise<StoredEvents> => ({ events: [], rejectedCount: 0 }),
    append: async () => undefined,
    reset: async () => undefined,
    ...overrides
  };
}

describe("evidence ledger integration", () => {
  it("rehydrates runtime events after seed events", async () => {
    const runtimeEvent = makeEvent("evt-runtime");
    const ledger = new EvidenceLedger(memory({
      load: async () => ({ events: [runtimeEvent], rejectedCount: 2 })
    }), [seedEvent]);

    await expect(ledger.load()).resolves.toEqual({
      events: [seedEvent, runtimeEvent],
      rejectedCount: 2
    });
  });

  it("rejects duplicate stored IDs and seed collisions", async () => {
    const duplicate = makeEvent("evt-duplicate");
    const duplicatedLedger = new EvidenceLedger(memory({
      load: async () => ({ events: [duplicate, duplicate], rejectedCount: 0 })
    }), [seedEvent]);
    await expect(duplicatedLedger.load()).rejects.toThrow("Stored evidence event ID evt-duplicate is duplicated");

    const collidingLedger = new EvidenceLedger(memory({
      load: async () => ({ events: [seedEvent], rejectedCount: 0 })
    }), [seedEvent]);
    await expect(collidingLedger.load()).rejects.toThrow("collides with a seed event");
  });

  it("serializes concurrent appends without losing either event", async () => {
    let releaseFirst!: () => void;
    const firstWrite = new Promise<void>((resolve) => { releaseFirst = resolve; });
    const appendedIds: string[] = [];
    const ledger = new EvidenceLedger(memory({
      append: async (event) => {
        appendedIds.push(event.id);
        if (event.id === "evt-first") await firstWrite;
      }
    }), [seedEvent]);

    const first = ledger.append(makeEvent("evt-first"));
    const second = ledger.append(makeEvent("evt-second"));
    await Promise.resolve();
    expect(appendedIds).toEqual(["evt-first"]);

    releaseFirst();
    await Promise.all([first, second]);
    expect(appendedIds).toEqual(["evt-first", "evt-second"]);
    expect(ledger.events.map((event) => event.id)).toEqual(["evt-seed", "evt-first", "evt-second"]);
  });

  it("does not mutate state on persistence failure and recovers the queue", async () => {
    let failNext = true;
    const ledger = new EvidenceLedger(memory({
      append: async () => {
        if (failNext) {
          failNext = false;
          throw new Error("disk full");
        }
      }
    }), [seedEvent]);

    await expect(ledger.append(makeEvent("evt-failed"))).rejects.toThrow("disk full");
    expect(ledger.events).toEqual([seedEvent]);
    await expect(ledger.append(makeEvent("evt-recovered"))).resolves.toHaveLength(2);
    expect(ledger.events.map((event) => event.id)).toEqual(["evt-seed", "evt-recovered"]);
  });

  it("rejects a duplicate append and resets persisted and projected state", async () => {
    let resetCount = 0;
    const ledger = new EvidenceLedger(memory({ reset: async () => { resetCount += 1; } }), [seedEvent]);

    await ledger.append(makeEvent("evt-runtime"));
    await expect(ledger.append(makeEvent("evt-runtime"))).rejects.toThrow("already exists");
    await expect(ledger.reset()).resolves.toEqual([seedEvent]);
    expect(resetCount).toBe(1);
  });

  it("keeps projected state when persistence reset fails", async () => {
    const ledger = new EvidenceLedger(memory({ reset: async () => { throw new Error("reset denied"); } }), [seedEvent]);
    await ledger.append(makeEvent("evt-runtime"));

    await expect(ledger.reset()).rejects.toThrow("reset denied");
    expect(ledger.events.map((event) => event.id)).toEqual(["evt-seed", "evt-runtime"]);
  });
});
