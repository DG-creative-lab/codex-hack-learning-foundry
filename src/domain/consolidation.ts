import { z } from "zod";
import { capabilityManifestSchema, type FoundryCapability } from "./capability";
import {
  type MicroWorldProjection,
  microWorldInteractionPayloadSchema,
  microWorldReflectionPayloadSchema
} from "./microWorld";
import { practicalApplicationPayloadSchema, practicalFeedbackPayloadSchema } from "./practicalEvidence";
import type { EvidenceEvent, LivingTheory, TheoryElement } from "./types";
import { theoryElementPayloadSchema } from "./types";
import {
  type ProjectedReviewItem,
  targetedReviewItemSchema,
  type UnderstandingCheckProjection
} from "./understandingChecks";

export const CONSOLIDATION_LIMITS = {
  idCharacters: 240,
  rationaleCharacters: 2400,
  triggerEvents: 16,
  reviewItems: 8,
  theoryRevisions: 8,
  capabilityRevisions: 4,
  proposals: 128
} as const;

const boundedIdSchema = z.string().min(1).max(CONSOLIDATION_LIMITS.idCharacters);
const boundedRationaleSchema = z.string().trim().min(3).max(CONSOLIDATION_LIMITS.rationaleCharacters);
const uniqueIdArray = (maximum: number) =>
  z
    .array(boundedIdSchema)
    .min(1)
    .max(maximum)
    .superRefine((ids, context) => {
      if (new Set(ids).size !== ids.length) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "Consolidation trigger IDs must be unique." });
      }
    });

export const consolidationReviewItemSchema = targetedReviewItemSchema.extend({ checkId: boundedIdSchema }).strict();
export const consolidationTheoryRevisionSchema = theoryElementPayloadSchema
  .extend({ revisesElementId: boundedIdSchema })
  .strict();

export const consolidationProposalSchema = z
  .object({
    id: boundedIdSchema,
    createdAt: z.string().datetime(),
    rationale: boundedRationaleSchema,
    triggerEventIds: uniqueIdArray(CONSOLIDATION_LIMITS.triggerEvents),
    reviewItems: z.array(consolidationReviewItemSchema).max(CONSOLIDATION_LIMITS.reviewItems),
    theoryRevisions: z.array(consolidationTheoryRevisionSchema).max(CONSOLIDATION_LIMITS.theoryRevisions),
    capabilityRevisions: z.array(capabilityManifestSchema).max(CONSOLIDATION_LIMITS.capabilityRevisions)
  })
  .strict()
  .superRefine((proposal, context) => {
    for (const [index, revision] of proposal.theoryRevisions.entries()) {
      if (revision.id === revision.revisesElementId) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "A theory revision must use a new ID.",
          path: ["theoryRevisions", index, "id"]
        });
      }
    }
    for (const [index, revision] of proposal.capabilityRevisions.entries()) {
      if (revision.status !== "draft" || !revision.supersedesCapabilityId) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "A capability revision must be a draft with a predecessor.",
          path: ["capabilityRevisions", index]
        });
      }
    }
    const ids = [
      ...proposal.reviewItems.map((item) => item.id),
      ...proposal.theoryRevisions.map((revision) => revision.id),
      ...proposal.capabilityRevisions.map((revision) => revision.id)
    ];
    if (new Set(ids).size !== ids.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Consolidation output IDs must be unique." });
    }
  });

export const consolidationProposedPayloadSchema = z.object({ proposal: consolidationProposalSchema }).strict();
export const consolidationReviewPayloadSchema = z
  .object({
    proposalId: boundedIdSchema,
    decision: z.enum(["approved", "rejected"]),
    reason: boundedRationaleSchema
  })
  .strict();

export type ConsolidationProposal = z.infer<typeof consolidationProposalSchema>;
export type ConsolidationReview = z.infer<typeof consolidationReviewPayloadSchema>;
export interface ConsolidationProposalProjection extends ConsolidationProposal {
  evidenceEventId: string;
  status: "pending" | "approved" | "rejected";
  review?: ConsolidationReview & { evidenceEventId: string; createdAt: string };
}

interface GenerateConsolidationInput {
  proposalId: string;
  createdAt: string;
  triggerEvents: EvidenceEvent[];
  theory: LivingTheory;
  capabilities: FoundryCapability[];
  checks: UnderstandingCheckProjection[];
  microWorlds: MicroWorldProjection[];
}

interface TriggerContext {
  event: EvidenceEvent;
  theoryElementIds: string[];
  sourceIds: string[];
  fragmentIds: string[];
  capabilityId?: string;
  correction?: string;
  failure?: string;
}

const practicalFeedbackEventTypes = new Set([
  "practical.observation_recorded",
  "practical.correction_recorded",
  "practical.failure_recorded",
  "practical.participation_recorded"
]);

function suffix(proposalId: string) {
  return proposalId.replace(/[^a-zA-Z0-9-]/g, "-").slice(-48);
}

function bounded(value: string, maximum: number) {
  return value.length <= maximum ? value : value.slice(0, maximum);
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function triggerContext(event: EvidenceEvent, worldsById: Map<string, MicroWorldProjection>): TriggerContext {
  if (event.type === "practical.application_recorded") {
    const application = practicalApplicationPayloadSchema.parse(event.payload);
    return {
      event,
      theoryElementIds: application.theoryElementIds,
      sourceIds: event.sourceIds,
      fragmentIds: [],
      capabilityId: application.capabilityId,
      failure: application.outcome === "failed" ? application.outputSummary : undefined
    };
  }
  if (practicalFeedbackEventTypes.has(event.type)) {
    const feedback = practicalFeedbackPayloadSchema.parse(event.payload);
    return {
      event,
      theoryElementIds: feedback.theoryElementIds,
      sourceIds: event.sourceIds,
      fragmentIds: [],
      capabilityId: feedback.capabilityId,
      correction: feedback.kind === "correction" ? feedback.content : undefined,
      failure: feedback.kind === "failure" ? feedback.content : undefined
    };
  }
  if (event.type === "learning.micro_world_interaction_recorded") {
    const interaction = microWorldInteractionPayloadSchema.parse(event.payload);
    const world = worldsById.get(interaction.artifactId);
    if (!world)
      throw new Error(`Consolidation trigger ${event.id} references unknown micro-world ${interaction.artifactId}`);
    return {
      event,
      theoryElementIds: world.theoryElementIds,
      sourceIds: world.sourceIds,
      fragmentIds: world.fragmentIds
    };
  }
  if (event.type === "learning.micro_world_reflection_recorded") {
    const reflection = microWorldReflectionPayloadSchema.parse(event.payload);
    const world = worldsById.get(reflection.artifactId);
    if (!world)
      throw new Error(`Consolidation trigger ${event.id} references unknown micro-world ${reflection.artifactId}`);
    return {
      event,
      theoryElementIds: world.theoryElementIds,
      sourceIds: world.sourceIds,
      fragmentIds: world.fragmentIds
    };
  }
  throw new Error(`Evidence event ${event.id} is not eligible for consolidation`);
}

function reviewItem(
  proposalId: string,
  contexts: TriggerContext[],
  checks: UnderstandingCheckProjection[]
): z.infer<typeof consolidationReviewItemSchema>[] {
  const theoryElementIds = unique(contexts.flatMap((context) => context.theoryElementIds));
  const eligibleChecks = checks.filter((candidate) =>
    ["prediction", "transfer", "explanation"].includes(candidate.kind)
  );
  const check =
    eligibleChecks.find((candidate) => candidate.theoryElementIds.some((id) => theoryElementIds.includes(id))) ??
    eligibleChecks.find((candidate) => candidate.kind === "transfer") ??
    eligibleChecks[0];
  if (!check) return [];
  const correction = contexts.find((context) => context.correction)?.correction;
  const failure = contexts.find((context) => context.failure)?.failure;
  return [
    {
      id: bounded(`review-${suffix(proposalId)}`, 200),
      checkId: check.id,
      title: failure
        ? "Review a practical failure"
        : correction
          ? "Reconcile the correction"
          : "Explain the observation",
      prompt: bounded(
        failure ?? correction ?? "Explain what the recorded practical observation changes about the current model.",
        2400
      ),
      theoryElementIds,
      sourceIds: unique(contexts.flatMap((context) => context.sourceIds)),
      fragmentIds: unique(contexts.flatMap((context) => context.fragmentIds))
    }
  ];
}

function theoryRevisions(
  proposalId: string,
  contexts: TriggerContext[],
  elementsById: Map<string, TheoryElement>
): z.infer<typeof consolidationTheoryRevisionSchema>[] {
  const context = contexts.find((candidate) => candidate.correction && candidate.theoryElementIds.length === 1);
  const previous = context ? elementsById.get(context.theoryElementIds[0]) : undefined;
  if (!context?.correction || !previous) return [];
  return [
    {
      ...previous,
      id: bounded(`${previous.id}-rev-${suffix(proposalId)}`, 240),
      title: bounded(`${previous.title} (revised)`, 240),
      statement: context.correction,
      epistemicKind: "user_interpretation",
      status: "active",
      sourceIds: unique([...previous.sourceIds, ...context.sourceIds]),
      fragmentIds: unique([...previous.fragmentIds, ...context.fragmentIds]),
      evidenceEventIds: unique([...previous.evidenceEventIds, context.event.id]),
      revisesElementId: previous.id
    }
  ];
}

function capabilityRevisions(
  proposalId: string,
  createdAt: string,
  contexts: TriggerContext[],
  capabilitiesById: Map<string, FoundryCapability>
): z.infer<typeof capabilityManifestSchema>[] {
  const context = contexts.find((candidate) => candidate.capabilityId && (candidate.correction || candidate.failure));
  const capability = context?.capabilityId ? capabilitiesById.get(context.capabilityId) : undefined;
  const feedback = context?.correction ?? context?.failure;
  if (!capability || !feedback) return [];
  const revisionNote = bounded(`Practical revision evidence: ${feedback}`, 1200);
  return [
    {
      ...capability.manifest,
      id: bounded(`${capability.manifest.id}-rev-${suffix(proposalId)}`, 240),
      version: bounded(`${capability.manifest.version}-revision-${suffix(proposalId)}`, 80),
      status: "draft",
      createdAt,
      assumptions: [...capability.manifest.assumptions.slice(0, 31), revisionNote],
      operatingBoundaries: [...capability.manifest.operatingBoundaries.slice(0, 31), revisionNote],
      supersedesCapabilityId: capability.manifest.id
    }
  ];
}

export function generateConsolidationProposal(input: GenerateConsolidationInput): ConsolidationProposal {
  const worldsById = new Map(input.microWorlds.map((world) => [world.id, world]));
  const contexts = input.triggerEvents.map((event) => triggerContext(event, worldsById));
  const proposal = {
    id: input.proposalId,
    createdAt: input.createdAt,
    rationale:
      "Consolidate practical evidence into review work and explicit revision proposals without mutating prior records.",
    triggerEventIds: contexts.map((context) => context.event.id),
    reviewItems: reviewItem(input.proposalId, contexts, input.checks),
    theoryRevisions: theoryRevisions(
      input.proposalId,
      contexts,
      new Map(input.theory.elements.map((element) => [element.id, element]))
    ),
    capabilityRevisions: capabilityRevisions(
      input.proposalId,
      input.createdAt,
      contexts,
      new Map(input.capabilities.map((capability) => [capability.manifest.id, capability]))
    )
  };
  if (proposal.reviewItems.length + proposal.theoryRevisions.length + proposal.capabilityRevisions.length === 0) {
    throw new Error("Eligible evidence did not produce a bounded consolidation proposal");
  }
  return consolidationProposalSchema.parse(proposal);
}

export function projectedConsolidationReviewItems(proposals: ConsolidationProposalProjection[]): ProjectedReviewItem[] {
  return proposals
    .filter((proposal) => proposal.status !== "rejected")
    .flatMap((proposal) =>
      proposal.reviewItems.map((item) => ({
        ...item,
        attemptEventId: proposal.triggerEventIds[0]
      }))
    );
}
