import type { FoundryCapability } from "./capability";
import {
  CONSOLIDATION_LIMITS,
  type ConsolidationProposalProjection,
  consolidationProposedPayloadSchema,
  consolidationReviewPayloadSchema,
  generateConsolidationProposal
} from "./consolidation";
import type { MicroWorldProjection } from "./microWorld";
import type { EvidenceEvent, LivingTheory, TheoryElement } from "./types";
import type { UnderstandingCheckProjection } from "./understandingChecks";

interface ConsolidationContext {
  theory: LivingTheory;
  capabilities: FoundryCapability[];
  understandingChecks: UnderstandingCheckProjection[];
  microWorlds: MicroWorldProjection[];
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function proposalSourceIds(proposal: ConsolidationProposalProjection) {
  return unique([
    ...proposal.reviewItems.flatMap((item) => item.sourceIds),
    ...proposal.theoryRevisions.flatMap((revision) => revision.sourceIds),
    ...proposal.capabilityRevisionRequests.flatMap((request) => request.sourceIds)
  ]);
}

function sameProposal(
  submitted: ReturnType<typeof consolidationProposedPayloadSchema.parse>["proposal"],
  canonical: ReturnType<typeof generateConsolidationProposal>
) {
  return JSON.stringify(submitted) === JSON.stringify(canonical);
}

function applyApprovedTheory(
  theory: LivingTheory,
  proposal: ConsolidationProposalProjection,
  reviewEvent: EvidenceEvent
): LivingTheory {
  const elements = new Map(theory.elements.map((element) => [element.id, element]));
  for (const revision of proposal.theoryRevisions) {
    const previous = elements.get(revision.revisesElementId);
    if (!previous) {
      throw new Error(`Consolidation theory revision ${revision.id} references a missing predecessor`);
    }
    elements.set(previous.id, { ...previous, status: "superseded" });
    const revised: TheoryElement = {
      ...revision,
      sourceIds: unique([...revision.sourceIds, ...reviewEvent.sourceIds]),
      evidenceEventIds: unique([...revision.evidenceEventIds, reviewEvent.id])
    };
    elements.set(revised.id, revised);
  }
  return {
    ...theory,
    revision: [...elements.values()].filter((element) => element.revisesElementId).length,
    elements: [...elements.values()],
    sourceIds: unique([...theory.sourceIds, ...reviewEvent.sourceIds]),
    evidenceEventIds: unique([...theory.evidenceEventIds, reviewEvent.id])
  };
}

function validateReviewScope(
  proposal: ConsolidationProposalProjection,
  checksById: Map<string, UnderstandingCheckProjection>
) {
  for (const item of proposal.reviewItems) {
    const check = checksById.get(item.checkId);
    if (!check) throw new Error(`Consolidation review item ${item.id} references unknown check ${item.checkId}`);
    const outsideScope = item.theoryElementIds.find((id) => !check.theoryElementIds.includes(id));
    if (outsideScope) {
      throw new Error(`Consolidation review item ${item.id} exceeds the theory scope of check ${item.checkId}`);
    }
  }
}

export function deriveConsolidationProposals(
  events: EvidenceEvent[],
  context: ConsolidationContext
): ConsolidationProposalProjection[] {
  const proposals = new Map<string, ConsolidationProposalProjection>();
  const priorEvents = new Map<string, EvidenceEvent>();
  const checksById = new Map(context.understandingChecks.map((check) => [check.id, check]));
  let currentTheory = context.theory;

  for (const event of events) {
    if (event.type === "consolidation.proposed") {
      if (event.actor !== "agent" || event.kind !== "agent_synthesis") {
        throw new Error(`Consolidation proposal ${event.id} must be recorded as agent synthesis`);
      }
      const { proposal } = consolidationProposedPayloadSchema.parse(event.payload);
      if (proposals.has(proposal.id)) throw new Error(`Consolidation proposal ID ${proposal.id} is duplicated`);
      if (proposal.createdAt !== event.createdAt) {
        throw new Error(`Consolidation proposal ${proposal.id} must use its evidence event timestamp`);
      }
      const triggerEvents = proposal.triggerEventIds.map((triggerId) => {
        const trigger = priorEvents.get(triggerId);
        if (!trigger) {
          throw new Error(`Consolidation proposal ${proposal.id} references missing or future trigger ${triggerId}`);
        }
        return trigger;
      });
      const canonical = generateConsolidationProposal({
        proposalId: proposal.id,
        createdAt: event.createdAt,
        triggerEvents,
        theory: currentTheory,
        capabilities: context.capabilities,
        checks: context.understandingChecks,
        microWorlds: context.microWorlds
      });
      if (!sameProposal(proposal, canonical)) {
        throw new Error(`Consolidation proposal ${proposal.id} does not match its canonical trigger-derived output`);
      }
      const projected: ConsolidationProposalProjection = {
        ...canonical,
        evidenceEventId: event.id,
        status: "pending"
      };
      validateReviewScope(projected, checksById);
      const missingSourceId = proposalSourceIds(projected).find((sourceId) => !event.sourceIds.includes(sourceId));
      if (missingSourceId) {
        throw new Error(`Consolidation proposal ${proposal.id} is missing provenance for ${missingSourceId}`);
      }
      proposals.set(proposal.id, projected);
    }

    if (event.type === "consolidation.reviewed") {
      if (event.actor !== "human" || event.kind !== "user_interpretation") {
        throw new Error(`Consolidation review ${event.id} must be recorded as a human interpretation`);
      }
      const review = consolidationReviewPayloadSchema.parse(event.payload);
      const proposal = proposals.get(review.proposalId);
      if (!proposal) {
        throw new Error(`Consolidation review ${event.id} references unknown proposal ${review.proposalId}`);
      }
      if (proposal.status !== "pending") {
        throw new Error(`Consolidation proposal ${review.proposalId} was already reviewed`);
      }
      const missingSourceId = proposalSourceIds(proposal).find((sourceId) => !event.sourceIds.includes(sourceId));
      if (missingSourceId) {
        throw new Error(`Consolidation review ${event.id} is missing provenance for ${missingSourceId}`);
      }
      const reviewed: ConsolidationProposalProjection = {
        ...proposal,
        status: review.decision,
        review: {
          ...review,
          evidenceEventId: event.id,
          createdAt: event.createdAt,
          sourceIds: event.sourceIds
        }
      };
      proposals.set(review.proposalId, reviewed);
      if (review.decision === "approved") currentTheory = applyApprovedTheory(currentTheory, reviewed, event);
    }
    priorEvents.set(event.id, event);
  }

  if (proposals.size > CONSOLIDATION_LIMITS.proposals) {
    throw new Error("Consolidation projection exceeds its bounded proposal limit");
  }
  return [...proposals.values()];
}
