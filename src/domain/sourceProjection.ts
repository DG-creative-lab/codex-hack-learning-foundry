import { z } from "zod";
import {
  type NormalizedSourceFragment,
  normalizedSourceFragmentSchema,
  type SourceSynthesisProposal,
  type SourceVersion,
  sourceExtractionErrorSchema,
  sourceSynthesisProposalSchema,
  sourceVersionSchema,
  synthesisReviewPayloadSchema
} from "./sourcePipeline";
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
const extractionPayloadSchema = z
  .object({
    sourceId: z.string().min(1),
    author: z.string().min(1),
    title: z.string().min(1).optional(),
    format: z.string().min(1).optional(),
    outputs: sourceOutputsSchema,
    version: sourceVersionSchema.optional(),
    fragments: z.array(normalizedSourceFragmentSchema).optional()
  })
  .strict();
const completedPayloadSchema = extractionPayloadSchema.omit({ version: true, fragments: true });
const synthesisCompletedPayloadSchema = extractionPayloadSchema.extend({
  version: sourceVersionSchema,
  fragments: z.array(normalizedSourceFragmentSchema),
  proposal: sourceSynthesisProposalSchema
});
const failedPayloadSchema = z.object({ sourceId: z.string().min(1), error: sourceExtractionErrorSchema }).strict();
const proposedPayloadSchema = z.object({ proposal: sourceSynthesisProposalSchema }).strict();

export interface SourcePipelineProjection {
  sources: SourceRecord[];
  versions: SourceVersion[];
  fragments: NormalizedSourceFragment[];
  proposals: SourceSynthesisProposal[];
}

export function deriveSourcePipeline(events: EvidenceEvent[]): SourcePipelineProjection {
  const sources = new Map<string, SourceRecord>();
  const versions = new Map<string, SourceVersion>();
  const fragments = new Map<string, NormalizedSourceFragment>();
  const proposals = new Map<string, SourceSynthesisProposal>();

  function recordExtraction(payload: z.infer<typeof extractionPayloadSchema>, event: EvidenceEvent) {
    const { sourceId, author, title, format, outputs, version, fragments: extractedFragments } = payload;
    if (!event.sourceIds.includes(sourceId))
      throw new Error(`Source event ${event.id} is missing provenance for ${sourceId}`);
    const source = sources.get(sourceId);
    if (!source) throw new Error(`Cannot complete unknown source ${sourceId}`);
    if (version) {
      if (version.sourceId !== sourceId) throw new Error(`Source version ${version.id} belongs to another source`);
      if (versions.has(version.id)) throw new Error(`Source version ID ${version.id} is duplicated`);
      const parsedFragments = extractedFragments ?? [];
      if (parsedFragments.map((fragment) => fragment.id).join("|") !== version.fragmentIds.join("|")) {
        throw new Error(`Source version ${version.id} fragment manifest does not match its fragments`);
      }
      for (const fragment of parsedFragments) {
        if (fragment.sourceId !== sourceId || fragment.versionId !== version.id) {
          throw new Error(`Source fragment ${fragment.id} does not belong to version ${version.id}`);
        }
        if (fragments.has(fragment.id)) throw new Error(`Source fragment ID ${fragment.id} is duplicated`);
        fragments.set(fragment.id, fragment);
      }
      versions.set(version.id, version);
    }
    const { error: _previousError, ...sourceWithoutError } = source;
    sources.set(sourceId, {
      ...sourceWithoutError,
      status: version ? "review" : "ready",
      progress: 100,
      author,
      title: title ?? source.title,
      format: format ?? source.format,
      outputs,
      currentVersionId: version?.id ?? source.currentVersionId,
      ...(version?.previousVersionId ? { previousVersionId: version.previousVersionId } : {})
    });
  }

  function recordProposal(proposal: SourceSynthesisProposal) {
    if (proposal.status !== "pending") throw new Error(`Synthesis proposal ${proposal.id} must enter as pending`);
    if (!sources.has(proposal.sourceId))
      throw new Error(`Synthesis proposal ${proposal.id} references an unknown source`);
    if (!versions.has(proposal.versionId))
      throw new Error(`Synthesis proposal ${proposal.id} references an unknown version`);
    const versionFragmentIds = new Set(versions.get(proposal.versionId)?.fragmentIds);
    const referencedFragmentIds = [
      ...proposal.elements.flatMap((candidate) => candidate.element.fragmentIds),
      ...proposal.relationships.flatMap((candidate) => candidate.relationship.fragmentIds)
    ];
    const unknownFragmentId = referencedFragmentIds.find((fragmentId) => !versionFragmentIds.has(fragmentId));
    if (unknownFragmentId) {
      throw new Error(`Synthesis proposal ${proposal.id} references fragment ${unknownFragmentId} outside its version`);
    }
    if (proposals.has(proposal.id)) throw new Error(`Synthesis proposal ID ${proposal.id} is duplicated`);
    proposals.set(proposal.id, proposal);
  }

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
      recordExtraction(completedPayloadSchema.parse(event.payload), event);
      continue;
    }

    if (event.type === "source.synthesis_completed") {
      const payload = synthesisCompletedPayloadSchema.parse(event.payload);
      if (payload.proposal.sourceId !== payload.sourceId || payload.proposal.versionId !== payload.version.id) {
        throw new Error(`Source synthesis event ${event.id} has inconsistent source or version provenance`);
      }
      recordExtraction(payload, event);
      recordProposal(payload.proposal);
      continue;
    }

    if (event.type === "source.processing_failed") {
      const { sourceId, error } = failedPayloadSchema.parse(event.payload);
      if (!event.sourceIds.includes(sourceId))
        throw new Error(`Source event ${event.id} is missing provenance for ${sourceId}`);
      const source = sources.get(sourceId);
      if (!source) throw new Error(`Cannot fail unknown source ${sourceId}`);
      sources.set(sourceId, { ...source, status: "failed", progress: 0, error });
      continue;
    }

    if (event.type === "theory.synthesis_proposed") {
      const { proposal } = proposedPayloadSchema.parse(event.payload);
      recordProposal(proposal);
      continue;
    }

    if (event.type === "theory.synthesis_reviewed") {
      const review = synthesisReviewPayloadSchema.parse(event.payload);
      const { proposalId, decision } = review;
      const proposal = proposals.get(proposalId);
      if (!proposal) throw new Error(`Cannot review unknown synthesis proposal ${proposalId}`);
      if (proposal.status !== "pending") {
        throw new Error(`Synthesis proposal ${proposalId} cannot transition from ${proposal.status} to ${decision}`);
      }
      if (!event.sourceIds.includes(proposal.sourceId)) {
        throw new Error(`Synthesis review ${event.id} is missing provenance for ${proposal.sourceId}`);
      }
      if (review.decision === "approved") {
        const expectedElements = proposal.elements.map((candidate) => candidate.element);
        const expectedRelationships = proposal.relationships.map((candidate) => candidate.relationship);
        if (
          JSON.stringify(review.elements) !== JSON.stringify(expectedElements) ||
          JSON.stringify(review.relationships) !== JSON.stringify(expectedRelationships)
        ) {
          throw new Error(`Synthesis approval ${event.id} does not match proposal ${proposalId}`);
        }
      }
      proposals.set(proposalId, { ...proposal, status: decision });
      const source = sources.get(proposal.sourceId);
      if (source) sources.set(source.id, { ...source, status: "ready" });
    }
  }

  return {
    sources: [...sources.values()].reverse(),
    versions: [...versions.values()],
    fragments: [...fragments.values()],
    proposals: [...proposals.values()].reverse()
  };
}

export function deriveSources(events: EvidenceEvent[]): SourceRecord[] {
  return deriveSourcePipeline(events).sources;
}
