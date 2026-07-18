import { type EvidenceEvent, evidenceEventSchema, type LivingTheory, livingTheorySchema } from "./types";

export interface TheoryReferenceProjection {
  theoryId: string;
  theoryElementIds: string[];
  contributedTheoryElementIds: string[];
  evidenceEventIds: string[];
}

export interface MemoryProjections {
  human: TheoryReferenceProjection;
  agent: TheoryReferenceProjection;
}

function projectionFor(
  theory: LivingTheory,
  events: EvidenceEvent[],
  actor: "human" | "agent"
): TheoryReferenceProjection {
  const activeElements = theory.elements.filter((element) => element.status !== "superseded");
  const actorEventIds = new Set(events.filter((event) => event.actor === actor).map((event) => event.id));

  return {
    theoryId: theory.id,
    theoryElementIds: activeElements.map((element) => element.id),
    contributedTheoryElementIds: activeElements
      .filter((element) => element.evidenceEventIds.some((eventId) => actorEventIds.has(eventId)))
      .map((element) => element.id),
    evidenceEventIds: [...actorEventIds]
  };
}

export function deriveMemoryProjections(theoryInput: LivingTheory, rawEvents: EvidenceEvent[]): MemoryProjections {
  const theory = livingTheorySchema.parse(theoryInput);
  const events = evidenceEventSchema.array().parse(rawEvents);

  return {
    human: projectionFor(theory, events, "human"),
    agent: projectionFor(theory, events, "agent")
  };
}
