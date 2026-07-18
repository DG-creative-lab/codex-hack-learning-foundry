import { evidenceEventSchema, type EvidenceEvent } from "../domain/types";
import type { EvidenceMemory, StoredEvents } from "./evidenceLedger";

export const browserLedgerKey = "learning-foundry-events";

export interface LedgerStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function createBrowserEvidenceMemory(
  storage: LedgerStorage,
  key = browserLedgerKey,
  now: () => number = Date.now
): EvidenceMemory {
  return {
    async load(): Promise<StoredEvents> {
      const value = storage.getItem(key);
      if (!value) return { events: [], rejectedCount: 0 };

      try {
        const result = evidenceEventSchema.array().safeParse(JSON.parse(value));
        if (result.success) return { events: result.data, rejectedCount: 0 };
      } catch {
        // Preserve the raw value below before clearing the active ledger.
      }

      storage.setItem(`${key}-rejected-${now()}`, value);
      storage.removeItem(key);
      return { events: [], rejectedCount: 1 };
    },

    async append(_event: EvidenceEvent, runtimeEvents: EvidenceEvent[]) {
      storage.setItem(key, JSON.stringify(runtimeEvents));
    },

    async reset() {
      storage.removeItem(key);
    }
  };
}
