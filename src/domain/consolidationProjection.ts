import {
  CONSOLIDATION_LIMITS,
  type ConsolidationProposalProjection,
  consolidationProposedPayloadSchema,
  consolidationReviewPayloadSchema
} from "./consolidation";
import type { EvidenceEvent } from "./types";

interface ConsolidationContext {
  sourceIds: Set<string>;
  fragmentIds: Set<string>;
  theoryElementIds: Set<string>;
  capabilityIds: Set<string>;
  understandingCheckIds: Set<string>;
}

function requireKnownIds(entity: string, ids: string[], knownIds: Set<string>, kind: string) {
  const unknownId = ids.find((id) => !knownIds.has(id));
  if (unknownId) throw new Error(`${entity} references unknown ${kind} ${unknownId}`);
}

function proposalSourceIds(proposal: ConsolidationProposalProjection) {
  return [
    ...new Set([
      ...proposal.reviewItems.flatMap((item) => item.sourceIds),
      ...proposal.theoryRevisions.flatMap((revision) => revision.sourceIds),
      ...proposal.capabilityRevisions.flatMap((revision) => revision.sourceIds)
    ])
  ];
}

export function deriveConsolidationProposals(
  events: EvidenceEvent[],
  context: ConsolidationContext
): ConsolidationProposalProjection[] {
  const proposals = new Map<string, ConsolidationProposalProjection>();
  const priorEventIds = new Set<string>();

  for (const event of events) {
    if (event.type === "consolidation.proposed") {
      if (event.actor !== "agent" || event.kind !== "agent_synthesis") {
        throw new Error(`Consolidation proposal ${event.id} must be recorded as agent synthesis`);
      }
      const { proposal } = consolidationProposedPayloadSchema.parse(event.payload);
      if (proposals.has(proposal.id)) throw new Error(`Consolidation proposal ID ${proposal.id} is duplicated`);
      const futureTriggerId = proposal.triggerEventIds.find((triggerId) => !priorEventIds.has(triggerId));
      if (futureTriggerId) {
        throw new Error(
          `Consolidation proposal ${proposal.id} references missing or future trigger ${futureTriggerId}`
        );
      }
      for (const item of proposal.reviewItems) {
        requireKnownIds(`Consolidation review item ${item.id}`, item.sourceIds, context.sourceIds, "source");
        requireKnownIds(`Consolidation review item ${item.id}`, item.fragmentIds, context.fragmentIds, "fragment");
        requireKnownIds(
          `Consolidation review item ${item.id}`,
          item.theoryElementIds,
          context.theoryElementIds,
          "theory element"
        );
        if (!context.understandingCheckIds.has(item.checkId)) {
          throw new Error(`Consolidation review item ${item.id} references unknown check ${item.checkId}`);
        }
      }
      for (const revision of proposal.theoryRevisions) {
        if (!context.theoryElementIds.has(revision.revisesElementId)) {
          throw new Error(
            `Consolidation theory revision ${revision.id} references unknown predecessor ${revision.revisesElementId}`
          );
        }
        requireKnownIds(
          `Consolidation theory revision ${revision.id}`,
          revision.sourceIds,
          context.sourceIds,
          "source"
        );
        requireKnownIds(
          `Consolidation theory revision ${revision.id}`,
          revision.fragmentIds,
          context.fragmentIds,
          "fragment"
        );
      }
      for (const revision of proposal.capabilityRevisions) {
        if (!revision.supersedesCapabilityId || !context.capabilityIds.has(revision.supersedesCapabilityId)) {
          throw new Error(`Consolidation capability revision ${revision.id} references an unknown predecessor`);
        }
        requireKnownIds(
          `Consolidation capability revision ${revision.id}`,
          revision.sourceIds,
          context.sourceIds,
          "source"
        );
        requireKnownIds(
          `Consolidation capability revision ${revision.id}`,
          revision.theoryElementIds,
          context.theoryElementIds,
          "theory element"
        );
      }
      const projected: ConsolidationProposalProjection = {
        ...proposal,
        evidenceEventId: event.id,
        status: "pending"
      };
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
      if (!proposal)
        throw new Error(`Consolidation review ${event.id} references unknown proposal ${review.proposalId}`);
      if (proposal.status !== "pending")
        throw new Error(`Consolidation proposal ${review.proposalId} was already reviewed`);
      const missingSourceId = proposalSourceIds(proposal).find((sourceId) => !event.sourceIds.includes(sourceId));
      if (missingSourceId) {
        throw new Error(`Consolidation review ${event.id} is missing provenance for ${missingSourceId}`);
      }
      proposals.set(review.proposalId, {
        ...proposal,
        status: review.decision,
        review: { ...review, evidenceEventId: event.id, createdAt: event.createdAt }
      });
    }
    priorEventIds.add(event.id);
  }

  if (proposals.size > CONSOLIDATION_LIMITS.proposals) {
    throw new Error("Consolidation projection exceeds its bounded proposal limit");
  }
  return [...proposals.values()];
}
