import { evidenceReference, latestTimestamp, memoryFreshness, uniqueEvidence } from "./memoryProjectionSupport";
import {
  type HumanDimensionProjection,
  type HumanMemoryDimension,
  type HumanMemoryProjection,
  type HumanTheoryProjection,
  humanMemoryDimensionSchema,
  type MemoryEvidenceReference
} from "./memoryProjectionTypes";
import type { MicroWorldProjection } from "./microWorld";
import type { EvidenceEvent, LivingTheory } from "./types";
import type { UnderstandingCheckProjection, UnderstandingDimension } from "./understandingChecks";

const understandingDimensionMap: Partial<Record<UnderstandingDimension, HumanMemoryDimension>> = {
  retrieval: "recall",
  explanation: "explanation",
  prediction: "prediction",
  transfer: "transfer",
  calibration: "uncertainty"
};

function emptyDimension(dimension: HumanMemoryDimension): HumanDimensionProjection {
  return {
    dimension,
    supportingEvidence: [],
    mixedEvidence: [],
    contradictoryEvidence: [],
    freshness: "unobserved"
  };
}

function emptyDimensions(): Record<HumanMemoryDimension, HumanDimensionProjection> {
  return Object.fromEntries(
    humanMemoryDimensionSchema.options.map((dimension) => [dimension, emptyDimension(dimension)])
  ) as Record<HumanMemoryDimension, HumanDimensionProjection>;
}

function addDimensionEvidence(
  elements: Map<string, HumanTheoryProjection>,
  theoryElementIds: string[],
  dimension: HumanMemoryDimension,
  reference: MemoryEvidenceReference
) {
  for (const theoryElementId of theoryElementIds) {
    const element = elements.get(theoryElementId);
    if (!element) continue;
    const projection = element.dimensions[dimension];
    const target =
      reference.signal === "supports"
        ? projection.supportingEvidence
        : reference.signal === "challenges"
          ? projection.contradictoryEvidence
          : projection.mixedEvidence;
    if (!target.some((item) => item.eventId === reference.eventId)) target.push(reference);
  }
}

function finalizeElements(elements: HumanTheoryProjection[], asOf: string): HumanTheoryProjection[] {
  return elements.map((element) => {
    for (const dimension of Object.values(element.dimensions)) {
      dimension.lastObservedAt = latestTimestamp(
        [...dimension.supportingEvidence, ...dimension.mixedEvidence, ...dimension.contradictoryEvidence].map(
          (item) => item.createdAt
        )
      );
      dimension.freshness = memoryFreshness(dimension.lastObservedAt, asOf);
    }
    const supportingEvidence = uniqueEvidence(
      Object.values(element.dimensions).flatMap((dimension) => dimension.supportingEvidence)
    );
    const contradictoryEvidence = uniqueEvidence(
      Object.values(element.dimensions).flatMap((dimension) => dimension.contradictoryEvidence)
    );
    const lastObservedAt = latestTimestamp(
      Object.values(element.dimensions)
        .map((dimension) => dimension.lastObservedAt)
        .filter((value): value is string => Boolean(value))
    );
    return {
      ...element,
      supportingEvidence,
      contradictoryEvidence,
      lastObservedAt,
      freshness: memoryFreshness(lastObservedAt, asOf)
    };
  });
}

export function deriveHumanMemory(
  theory: LivingTheory,
  eventsById: Map<string, EvidenceEvent>,
  checks: UnderstandingCheckProjection[],
  microWorlds: MicroWorldProjection[],
  asOf: string
): HumanMemoryProjection {
  const activeElements = theory.elements.filter((element) => element.status !== "superseded");
  const elements = new Map<string, HumanTheoryProjection>(
    activeElements.map((element) => [
      element.id,
      {
        theoryElementId: element.id,
        title: element.title,
        dimensions: emptyDimensions(),
        supportingEvidence: [],
        contradictoryEvidence: [],
        freshness: "unobserved"
      }
    ])
  );

  for (const check of checks) {
    for (const attempt of check.attempts) {
      if (attempt.dispute) {
        const disputeEvent = eventsById.get(attempt.dispute.evidenceEventId);
        if (disputeEvent) {
          addDimensionEvidence(
            elements,
            check.theoryElementIds,
            "uncertainty",
            evidenceReference(
              disputeEvent,
              "mixed",
              `The learner disputed evaluation ${attempt.eventId}. Correction: ${attempt.dispute.correction}`
            )
          );
        }
        continue;
      }
      const event = eventsById.get(attempt.eventId);
      if (!event) continue;
      for (const signal of attempt.evaluation.signals) {
        const dimension = understandingDimensionMap[signal.dimension];
        if (!dimension) continue;
        addDimensionEvidence(
          elements,
          signal.theoryElementIds,
          dimension,
          evidenceReference(event, signal.signal, signal.rationale)
        );
      }
    }
  }

  for (const world of microWorlds) {
    for (const prediction of world.predictions) {
      const event = eventsById.get(prediction.evidenceEventId);
      if (!event) continue;
      addDimensionEvidence(
        elements,
        world.theoryElementIds,
        "prediction",
        evidenceReference(
          event,
          "mixed",
          "A hypothesis was recorded before outcome reveal; correctness is not inferred."
        )
      );
    }
    for (const interaction of world.interactions) {
      const event = eventsById.get(interaction.evidenceEventId);
      if (!event) continue;
      addDimensionEvidence(
        elements,
        world.theoryElementIds,
        "participation",
        evidenceReference(event, "supports", "The learner deliberately recorded a changed configuration.")
      );
    }
    for (const reflection of world.reflections) {
      const event = eventsById.get(reflection.evidenceEventId);
      if (!event) continue;
      addDimensionEvidence(
        elements,
        world.theoryElementIds,
        "participation",
        evidenceReference(
          event,
          "supports",
          `The learner interpreted recorded interaction ${reflection.interactionEventId}.`
        )
      );
    }
  }

  const projectedElements = finalizeElements([...elements.values()], asOf);
  const humanEventIds = new Set(
    [...eventsById.values()].filter((event) => event.actor === "human").map((event) => event.id)
  );
  return {
    theoryId: theory.id,
    theoryElementIds: activeElements.map((element) => element.id),
    contributedTheoryElementIds: activeElements
      .filter((element) => element.evidenceEventIds.some((eventId) => humanEventIds.has(eventId)))
      .map((element) => element.id),
    elements: projectedElements,
    supportingEvidence: uniqueEvidence(projectedElements.flatMap((element) => element.supportingEvidence)),
    mixedEvidence: uniqueEvidence(
      projectedElements.flatMap((element) =>
        Object.values(element.dimensions).flatMap((dimension) => dimension.mixedEvidence)
      )
    ),
    contradictoryEvidence: uniqueEvidence(projectedElements.flatMap((element) => element.contradictoryEvidence)),
    staleTheoryElementIds: projectedElements
      .filter((element) => element.freshness === "stale")
      .map((element) => element.theoryElementId)
  };
}
