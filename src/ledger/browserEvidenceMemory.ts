import { evidenceEventSchema, type EvidenceEvent } from "../domain/types";
import type { EvidenceMemory, StoredEvents } from "./evidenceLedger";

export const browserLedgerKey = "learning-foundry-events";

export interface LedgerStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface LedgerMetadata {
  version: 1;
  generation: number;
  length: number;
}

export function createBrowserEvidenceMemory(
  storage: LedgerStorage,
  key = browserLedgerKey,
  now: () => number = Date.now
): EvidenceMemory {
  const metadataKey = `${key}:meta`;
  const entryKey = (generation: number, index: number) => `${key}:g${generation}:${index}`;
  const quarantine = (label: string, raw: string) => storage.setItem(`${key}-rejected-${now()}-${label}`, raw);

  function parseMetadata(raw: string | null): LedgerMetadata | undefined {
    if (!raw) return undefined;
    try {
      const value = JSON.parse(raw) as Partial<LedgerMetadata>;
      const { generation, length } = value;
      if (value.version === 1 && typeof generation === "number" && typeof length === "number" && Number.isSafeInteger(generation) && Number.isSafeInteger(length) && generation >= 0 && length >= 0) {
        return { version: 1, generation, length };
      }
    } catch {
      // Invalid metadata is quarantined by load.
    }
    return undefined;
  }

  function writeJournal(events: EvidenceEvent[], generation: number) {
    events.forEach((event, index) => storage.setItem(entryKey(generation, index), JSON.stringify(event)));
    storage.setItem(metadataKey, JSON.stringify({ version: 1, generation, length: events.length } satisfies LedgerMetadata));
  }

  function removeGeneration(metadata: LedgerMetadata) {
    for (let index = 0; index < metadata.length; index += 1) storage.removeItem(entryKey(metadata.generation, index));
  }

  async function load(): Promise<StoredEvents> {
    const rawMetadata = storage.getItem(metadataKey);
    const metadata = parseMetadata(rawMetadata);

    if (rawMetadata && !metadata) {
      quarantine("metadata", rawMetadata);
      storage.removeItem(metadataKey);
      return { events: [], rejectedCount: 1 };
    }

    if (!metadata) {
      const legacy = storage.getItem(key);
      if (!legacy) return { events: [], rejectedCount: 0 };
      try {
        const result = evidenceEventSchema.array().safeParse(JSON.parse(legacy));
        if (result.success) {
          writeJournal(result.data, 0);
          storage.removeItem(key);
          return { events: result.data, rejectedCount: 0 };
        }
      } catch {
        // Preserve the legacy payload below before clearing it.
      }
      quarantine("legacy", legacy);
      storage.removeItem(key);
      return { events: [], rejectedCount: 1 };
    }

    const events: EvidenceEvent[] = [];
    let rejectedCount = 0;
    for (let index = 0; index < metadata.length; index += 1) {
      const raw = storage.getItem(entryKey(metadata.generation, index));
      if (!raw) {
        rejectedCount += 1;
        continue;
      }
      try {
        const result = evidenceEventSchema.safeParse(JSON.parse(raw));
        if (result.success) events.push(result.data);
        else {
          quarantine(`g${metadata.generation}-${index}`, raw);
          rejectedCount += 1;
        }
      } catch {
        quarantine(`g${metadata.generation}-${index}`, raw);
        rejectedCount += 1;
      }
    }

    if (rejectedCount > 0) {
      writeJournal(events, metadata.generation + 1);
      removeGeneration(metadata);
    }
    return { events, rejectedCount };
  }

  return {
    load,

    async append(event: EvidenceEvent) {
      let metadata = parseMetadata(storage.getItem(metadataKey));
      if (!metadata) {
        await load();
        metadata = parseMetadata(storage.getItem(metadataKey)) ?? { version: 1, generation: 0, length: 0 };
      }
      storage.setItem(entryKey(metadata.generation, metadata.length), JSON.stringify(event));
      storage.setItem(metadataKey, JSON.stringify({ ...metadata, length: metadata.length + 1 }));
    },

    async reset() {
      const metadata = parseMetadata(storage.getItem(metadataKey));
      if (metadata) removeGeneration(metadata);
      storage.removeItem(metadataKey);
      storage.removeItem(key);
    }
  };
}
