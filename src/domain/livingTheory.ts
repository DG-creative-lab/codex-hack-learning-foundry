import { z } from "zod";
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

function elementFromEvent(event: EvidenceEvent): TheoryElement {
  const rawElement = theoryElementPayloadSchema.parse(event.payload.element);
  if (rawElement.epistemicKind !== event.kind) {
    throw new Error(`Theory element ${rawElement.id} must use the epistemic kind of its evidence event.`);
  }
  return theoryElementSchema.parse({
    ...rawElement,
    sourceIds: unique([...rawElement.sourceIds, ...event.sourceIds]),
    fragmentIds: unique(rawElement.fragmentIds),
    evidenceEventIds: unique([...rawElement.evidenceEventIds, event.id])
  });
}

function relationshipFromEvent(event: EvidenceEvent): TheoryRelationship {
  const rawRelationship = theoryRelationshipSchema.parse(event.payload.relationship);
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
  const theoryEventIds: string[] = [];

  for (const event of events) {
    if (eventIds.has(event.id)) {
      throw new Error(`Evidence event ID ${event.id} is duplicated.`);
    }
    eventIds.add(event.id);

    if (elementEventTypes.has(event.type)) {
      const element = elementFromEvent(event);

      if (event.type === "theory.element_revised" && element.id === element.revisesElementId) {
        throw new Error(`Theory revision ${event.id} must use a new element ID.`);
      }
      if (elements.has(element.id)) {
        throw new Error(`Theory element ID ${element.id} is duplicated.`);
      }

      if (event.type === "theory.element_revised") {
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

    if (event.type === "theory.relationship_recorded") {
      const relationship = relationshipFromEvent(event);
      if (relationships.has(relationship.id)) {
        throw new Error(`Theory relationship ID ${relationship.id} is duplicated.`);
      }
      relationships.set(relationship.id, relationship);
      theoryEventIds.push(event.id);
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
