import { z } from "zod";
import { deriveExplainers } from "./explainer";
import { deriveLivingTheory, livingTheoryMetadataSchema } from "./livingTheory";
import { deriveMemoryProjections } from "./memoryProjections";
import { deriveSourcePipeline } from "./sourceProjection";
import { type EvidenceEvent, evidenceEventSchema } from "./types";
import {
  capabilityEvaluationSchema,
  capabilityManifestSchema,
  type FoundryCapability,
  foundryCapabilitySchema,
  type LearningArtifact,
  learningArtifactSchema
} from "./workspaceEntities";

const workspaceConfiguredPayloadSchema = z.object({ theory: livingTheoryMetadataSchema }).strict();
const learningArtifactPayloadSchema = z.object({ artifact: learningArtifactSchema }).strict();
const capabilityRegisteredPayloadSchema = z.object({ manifest: capabilityManifestSchema }).strict();
const capabilityEvaluationPayloadSchema = z
  .object({ capabilityId: z.string().min(1), evaluation: capabilityEvaluationSchema })
  .strict();
const capabilityExecutionPayloadSchema = z.object({ capabilityId: z.string().min(1) }).strict();

function requireKnownSources(entity: string, sourceIds: string[], knownSourceIds: Set<string>) {
  const unknownSourceId = sourceIds.find((sourceId) => !knownSourceIds.has(sourceId));
  if (unknownSourceId) throw new Error(`${entity} references unknown source ${unknownSourceId}`);
}

function requireEventProvenance(event: EvidenceEvent, entity: string, sourceIds: string[]) {
  const missingSourceId = sourceIds.find((sourceId) => !event.sourceIds.includes(sourceId));
  if (missingSourceId) throw new Error(`${entity} event ${event.id} is missing provenance for ${missingSourceId}`);
}

function deriveLearningArtifacts(events: EvidenceEvent[], knownSourceIds: Set<string>): LearningArtifact[] {
  const artifacts = new Map<string, LearningArtifact>();
  for (const event of events) {
    if (event.type !== "learning.artifact_registered") continue;
    const { artifact } = learningArtifactPayloadSchema.parse(event.payload);
    if (artifacts.has(artifact.id)) throw new Error(`Learning artifact ID ${artifact.id} is duplicated`);
    requireKnownSources(`Learning artifact ${artifact.id}`, artifact.sourceIds, knownSourceIds);
    requireEventProvenance(event, `Learning artifact ${artifact.id}`, artifact.sourceIds);
    artifacts.set(artifact.id, artifact);
  }
  return [...artifacts.values()];
}

function deriveCapabilities(events: EvidenceEvent[], knownSourceIds: Set<string>): FoundryCapability[] {
  const capabilities = new Map<string, FoundryCapability>();

  for (const event of events) {
    if (event.type === "capability.registered") {
      const { manifest } = capabilityRegisteredPayloadSchema.parse(event.payload);
      if (capabilities.has(manifest.id)) throw new Error(`Capability ID ${manifest.id} is duplicated`);
      requireKnownSources(`Capability ${manifest.id}`, manifest.sourceIds, knownSourceIds);
      requireEventProvenance(event, `Capability ${manifest.id}`, manifest.sourceIds);
      capabilities.set(manifest.id, { manifest, evaluation: null, executions: 0 });
    }

    if (event.type === "capability.evaluation_recorded") {
      const { capabilityId, evaluation } = capabilityEvaluationPayloadSchema.parse(event.payload);
      const capability = capabilities.get(capabilityId);
      if (!capability) throw new Error(`Cannot evaluate unknown capability ${capabilityId}`);
      capabilities.set(capabilityId, { ...capability, evaluation });
    }

    if (event.type === "capability.executed") {
      const { capabilityId } = capabilityExecutionPayloadSchema.parse(event.payload);
      const capability = capabilities.get(capabilityId);
      if (!capability) throw new Error(`Cannot execute unknown capability ${capabilityId}`);
      capabilities.set(capabilityId, { ...capability, executions: capability.executions + 1 });
    }
  }

  return foundryCapabilitySchema.array().parse([...capabilities.values()]);
}

export function reduceWorkspace(rawEvents: EvidenceEvent[]) {
  const events = evidenceEventSchema.array().parse(rawEvents);
  const configurationEvents = events.filter((event) => event.type === "workspace.configured");
  if (configurationEvents.length !== 1) {
    throw new Error(
      `Workspace projection requires exactly one configuration event; received ${configurationEvents.length}`
    );
  }

  const { theory: theoryMetadata } = workspaceConfiguredPayloadSchema.parse(configurationEvents[0].payload);
  const sourcePipeline = deriveSourcePipeline(events);
  const { sources } = sourcePipeline;
  const knownSourceIds = new Set(sources.map((source) => source.id));
  for (const event of events) requireKnownSources(`Evidence event ${event.id}`, event.sourceIds, knownSourceIds);
  requireKnownSources("Workspace theory", theoryMetadata.sourceIds, knownSourceIds);
  requireEventProvenance(configurationEvents[0], "Workspace theory", theoryMetadata.sourceIds);
  const theory = deriveLivingTheory(events, { ...theoryMetadata, sourceIds: [...knownSourceIds] });
  const knownFragmentIds = new Set(sourcePipeline.fragments.map((fragment) => fragment.id));
  const theoryFragmentIds = [
    ...theory.elements.flatMap((element) => element.fragmentIds),
    ...theory.relationships.flatMap((relationship) => relationship.fragmentIds)
  ];
  const unknownTheoryFragmentId = theoryFragmentIds.find((fragmentId) => !knownFragmentIds.has(fragmentId));
  if (unknownTheoryFragmentId) throw new Error(`Living Theory references unknown fragment ${unknownTheoryFragmentId}`);
  const explainers = deriveExplainers(events, {
    sourceIds: knownSourceIds,
    fragments: new Map(sourcePipeline.fragments.map((fragment) => [fragment.id, fragment])),
    theoryElementIds: new Set(theory.elements.map((element) => element.id))
  });

  return {
    sources,
    sourceVersions: sourcePipeline.versions,
    sourceFragments: sourcePipeline.fragments,
    synthesisProposals: sourcePipeline.proposals,
    theory,
    memories: deriveMemoryProjections(theory, events),
    learningArtifacts: deriveLearningArtifacts(events, knownSourceIds),
    explainers,
    capabilities: deriveCapabilities(events, knownSourceIds)
  };
}

export type WorkspaceProjection = ReturnType<typeof reduceWorkspace>;
