/// <reference types="vite/client" />

import type { EvidenceEvent } from "./domain/types";

declare global {
  interface Window {
    foundryMemory?: {
      load: () => Promise<{ events: EvidenceEvent[]; rejectedCount: number }>;
      append: (entry: EvidenceEvent) => Promise<boolean>;
      reset: () => Promise<boolean>;
    };
  }
}

export {};
