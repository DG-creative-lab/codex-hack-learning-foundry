import { z } from "zod";
import { consolidationProposedPayloadSchema, consolidationReviewPayloadSchema } from "./consolidation";
import { synthesisReviewPayloadSchema } from "./sourcePipeline";
import {
  type EvidenceEvent,
  evidenceEventSchema,
  type LivingTheory,
  livingTheorySchema,
  type TheoryElement,
  type TheoryRelationship,
  theoryElementPayloadSchema,
  theoryElementSchema,
  theoryRelationshipSchema
} from "./types";

const elementEventTypes = new Set(["theory.element_recorded", "theory.element_revised"]);

export const livingTheoryMetadataSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    summary: z.string().optional(),
    sourceIds: z.array(z.string().min(1))
  })
  .strict();

export type LivingTheoryMetadata = z.infer<typeof livingTheoryMetadataSchema>;

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function elementFromPayload(raw: unknown, event: EvidenceEvent, enforceEventKind: boolean): TheoryElement {
  const rawElement = theoryElementPayloadSchema.parse(raw);
  if (enforceEventKind && rawElement.epistemicKind !== event.kind) {
    throw new Error(`Theory element ${rawElement.id} must use the epistemic kind of its evidence event.`);
  }
  return theoryElementSchema.parse({
    ...rawElement,
    sourceIds: unique([...rawElement.sourceIds, ...event.sourceIds]),
    fragmentIds: unique(rawElement.fragmentIds),
    evidenceEventIds: unique([...rawElement.evidenceEventIds, event.id])
  });
}

function relationshipFromPayload(raw: unknown, event: EvidenceEvent): TheoryRelationship {
  const rawRelationship = theoryRelationshipSchema.parse(raw);
  return {
    ...rawRelationship,
    sourceIds: unique([...rawRelationship.sourceIds, ...event.sourceIds]),
    fragmentIds: unique(rawRelationship.fragmentIds),
    evidenceEventIds: unique([...rawRelationship.evidenceEventIds, event.id])
  };
}

export function deriveLivingTheory(rawEvents: EvidenceEvent[], metadata: LivingTheoryMetadata): LivingTheory {
  const events = evidenceEventSchema.array().parse(rawEvents);
  const eventIds = new Set<string>();
  const elements = new Map<string, TheoryElement>();
  const relationships = new Map<string, TheoryRelationship>();
  const consolidationProposals = new Map<string, z.infer<typeof consolidationProposedPayloadSchema>["proposal"]>();
  const reviewedConsolidationIds = new Set<string>();
  const theoryEventIds: string[] = [];

  function recordElement(element: TheoryElement, event: EvidenceEvent, revision: boolean) {
    if (revision && element.id === element.revisesElementId) {
      throw new Error(`Theory revision ${event.id} must use a new element ID.`);
    }
    if (elements.has(element.id)) throw new Error(`Theory element ID ${element.id} is duplicated.`);
    if (revision) {
      if (!element.revisesElementId) {
        throw new Error(`Theory revision ${event.id} must identify the element it revises.`);
      }
      const previous = elements.get(element.revisesElementId);
      if (!previous) {
        throw new Error(`Theory revision ${event.id} references missing element ${element.revisesElementId}.`);
      }
      elements.set(previous.id, { ...previous, status: "superseded" });
    }
    elements.set(element.id, element);
    theoryEventIds.push(event.id);
  }

  function recordRelationship(relationship: TheoryRelationship, event: EvidenceEvent) {
    if (relationships.has(relationship.id)) {
      throw new Error(`Theory relationship ID ${relationship.id} is duplicated.`);
    }
    relationships.set(relationship.id, relationship);
    theoryEventIds.push(event.id);
  }

  for (const event of events) {
    if (eventIds.has(event.id)) {
      throw new Error(`Evidence event ID ${event.id} is duplicated.`);
    }
    eventIds.add(event.id);

    if (elementEventTypes.has(event.type)) {
      recordElement(
        elementFromPayload(event.payload.element, event, true),
        event,
        event.type === "theory.element_revised"
      );
    }

    if (event.type === "theory.relationship_recorded") {
      recordRelationship(relationshipFromPayload(event.payload.relationship, event), event);
    }

    if (event.type === "theory.synthesis_reviewed") {
      const review = synthesisReviewPayloadSchema.parse(event.payload);
      if (review.decision === "approved") {
        for (const rawElement of review.elements) {
          const element = elementFromPayload(rawElement, event, false);
          recordElement(element, event, Boolean(element.revisesElementId));
        }
        for (const rawRelationship of review.relationships) {
          recordRelationship(relationshipFromPayload(rawRelationship, event), event);
        }
      }
    }

    if (event.type === "consolidation.proposed") {
      if (event.actor !== "agent" || event.kind !== "agent_synthesis") {
        throw new Error(`Consolidation proposal ${event.id} must be recorded as agent synthesis.`);
      }
      const { proposal } = consolidationProposedPayloadSchema.parse(event.payload);
      if (consolidationProposals.has(proposal.id)) {
        throw new Error(`Consolidation proposal ID ${proposal.id} is duplicated.`);
      }
      consolidationProposals.set(proposal.id, proposal);
    }

    if (event.type === "consolidation.reviewed") {
      if (event.actor !== "human" || event.kind !== "user_interpretation") {
        throw new Error(`Consolidation review ${event.id} must be recorded as a human interpretation.`);
      }
      const review = consolidationReviewPayloadSchema.parse(event.payload);
      const proposal = consolidationProposals.get(review.proposalId);
      if (!proposal)
        throw new Error(`Consolidation review ${event.id} references unknown proposal ${review.proposalId}.`);
      if (reviewedConsolidationIds.has(review.proposalId)) {
        throw new Error(`Consolidation proposal ${review.proposalId} was already reviewed.`);
      }
      reviewedConsolidationIds.add(review.proposalId);
      if (review.decision === "approved") {
        for (const rawElement of proposal.theoryRevisions) {
          recordElement(elementFromPayload(rawElement, event, true), event, true);
        }
      }
    }
  }

  for (const relationship of relationships.values()) {
    if (!elements.has(relationship.fromElementId) || !elements.has(relationship.toElementId)) {
      throw new Error(`Theory relationship ${relationship.id} references an unknown element.`);
    }
  }

  const knownSourceIds = new Set(metadata.sourceIds);
  const referencedSourceIds = unique([
    ...[...elements.values()].flatMap((element) => element.sourceIds),
    ...[...relationships.values()].flatMap((relationship) => relationship.sourceIds)
  ]);
  const unknownSourceId = referencedSourceIds.find((sourceId) => !knownSourceIds.has(sourceId));
  if (unknownSourceId) {
    throw new Error(`Living Theory references unknown source ${unknownSourceId}.`);
  }

  const projectedElements = [...elements.values()];
  const projectedRelationships = [...relationships.values()];

  return livingTheorySchema.parse({
    id: metadata.id,
    title: metadata.title,
    summary: metadata.summary ?? "",
    revision: projectedElements.filter((element) => element.revisesElementId).length,
    elements: projectedElements,
    relationships: projectedRelationships,
    sourceIds: unique([
      ...projectedElements.flatMap((element) => element.sourceIds),
      ...projectedRelationships.flatMap((relationship) => relationship.sourceIds)
    ]),
    evidenceEventIds: unique(theoryEventIds)
  });
}
