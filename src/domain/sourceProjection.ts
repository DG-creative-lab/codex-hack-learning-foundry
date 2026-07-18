import { z } from "zod";
import type { EvidenceEvent } from "./types";
import { type SourceRecord, sourceOutputsSchema, sourceRecordSchema } from "./workspaceEntities";

export {
  type SourceOrigin,
  type SourceRecord,
  type SourceStatus,
  sourceOriginSchema,
  sourceOutputsSchema,
  sourceRecordSchema,
  sourceStatusSchema
} from "./workspaceEntities";

const registeredPayloadSchema = z.object({ source: sourceRecordSchema }).strict();
const processingPayloadSchema = z
  .object({ sourceId: z.string().min(1), progress: z.number().min(0).max(100) })
  .strict();
const completedPayloadSchema = z
  .object({
    sourceId: z.string().min(1),
    author: z.string().min(1),
    outputs: sourceOutputsSchema
  })
  .strict();

export function deriveSources(events: EvidenceEvent[]): SourceRecord[] {
  const sources = new Map<string, SourceRecord>();

  for (const event of events) {
    if (event.type === "source.registered") {
      const { source } = registeredPayloadSchema.parse(event.payload);
      if (!event.sourceIds.includes(source.id))
        throw new Error(`Source event ${event.id} is missing provenance for ${source.id}`);
      if (sources.has(source.id)) throw new Error(`Source ID ${source.id} is duplicated`);
      sources.set(source.id, source);
      continue;
    }

    if (event.type === "source.processing_started") {
      const { sourceId, progress } = processingPayloadSchema.parse(event.payload);
      if (!event.sourceIds.includes(sourceId))
        throw new Error(`Source event ${event.id} is missing provenance for ${sourceId}`);
      const source = sources.get(sourceId);
      if (!source) throw new Error(`Cannot process unknown source ${sourceId}`);
      sources.set(sourceId, { ...source, status: "processing", progress });
      continue;
    }

    if (event.type === "source.processing_completed") {
      const { sourceId, author, outputs } = completedPayloadSchema.parse(event.payload);
      if (!event.sourceIds.includes(sourceId))
        throw new Error(`Source event ${event.id} is missing provenance for ${sourceId}`);
      const source = sources.get(sourceId);
      if (!source) throw new Error(`Cannot complete unknown source ${sourceId}`);
      sources.set(sourceId, { ...source, status: "ready", progress: 100, author, outputs });
    }
  }

  return [...sources.values()].reverse();
}
