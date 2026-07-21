/// <reference types="vite/client" />

import type { z } from "zod";
import type {
  liveExecutionAvailabilitySchema,
  liveExecutionRequestSchema,
  liveExecutionResponseSchema
} from "../shared/execution-contract.js";
import type { ExtractedSourceDocument, SourceExtractionError } from "./domain/sourcePipeline";
import type { EvidenceEvent } from "./domain/types";

declare global {
  interface Window {
    foundryMemory?: {
      load: () => Promise<{ events: EvidenceEvent[]; rejectedCount: number }>;
      append: (entry: EvidenceEvent) => Promise<boolean>;
      reset: () => Promise<boolean>;
    };
    foundrySources?: {
      extract: (request: {
        origin: "local" | "web";
        provenance: string;
      }) => Promise<{ ok: true; document: ExtractedSourceDocument } | { ok: false; error: SourceExtractionError }>;
    };
    foundryExecution?: {
      liveAvailability: () => Promise<z.infer<typeof liveExecutionAvailabilitySchema>>;
      runLive: (
        request: z.infer<typeof liveExecutionRequestSchema>
      ) => Promise<z.infer<typeof liveExecutionResponseSchema>>;
    };
  }
}
