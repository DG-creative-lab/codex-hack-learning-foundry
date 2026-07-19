import { evidenceReference, latestTimestamp, memoryFreshness, uniqueEvidence } from "./memoryProjectionSupport";
import type {
  AgentMemoryProjection,
  HumanMemoryProjection,
  SharedTheoryAgreement,
  SharedTheoryElementProjection,
  SharedTheoryProjection
} from "./memoryProjectionTypes";
import type { EvidenceEvent, LivingTheory } from "./types";

function relationshipEventIds(theory: LivingTheory, elementId: string, kind: "supports" | "contradicts") {
  return theory.relationships
    .filter(
      (relationship) =>
        relationship.kind === kind &&
        (relationship.fromElementId === elementId || relationship.toElementId === elementId)
    )
    .flatMap((relationship) => relationship.evidenceEventIds);
}

export function deriveSharedTheoryMemory(
  theory: LivingTheory,
  eventsById: Map<string, EvidenceEvent>,
  human: HumanMemoryProjection,
  agent: AgentMemoryProjection,
  asOf: string
): SharedTheoryProjection {
  const humanById = new Map(human.elements.map((element) => [element.theoryElementId, element]));
  const agentContributions = new Set(agent.contributedTheoryElementIds);
  const elements = theory.elements
    .filter((element) => element.status !== "superseded")
    .map<SharedTheoryElementProjection>((element) => {
      const humanElement = humanById.get(element.id);
      const supportingEventIds = [
        ...element.evidenceEventIds,
        ...relationshipEventIds(theory, element.id, "supports"),
        ...(humanElement?.supportingEvidence.map((reference) => reference.eventId) ?? [])
      ];
      const contradictoryEventIds = [
        ...relationshipEventIds(theory, element.id, "contradicts"),
        ...(element.kind === "contradiction" ? element.evidenceEventIds : [])
      ];
      const supportingEvidence = uniqueEvidence(
        supportingEventIds
          .map((eventId) => eventsById.get(eventId))
          .filter((event): event is EvidenceEvent => Boolean(event))
          .map((event) => evidenceReference(event, "supports", "Evidence supports or grounds this theory element."))
      );
      const contradictoryEvidence = uniqueEvidence(
        contradictoryEventIds
          .map((eventId) => eventsById.get(eventId))
          .filter((event): event is EvidenceEvent => Boolean(event))
          .map((event) =>
            evidenceReference(event, "challenges", "Evidence records a contradiction involving this element.")
          )
      );
      const coverage = {
        source: element.sourceIds.length > 0,
        human: Boolean(humanElement?.lastObservedAt) || element.epistemicKind === "user_interpretation",
        agent: agentContributions.has(element.id) || element.epistemicKind === "agent_synthesis"
      };
      const humanSupport = (humanElement?.supportingEvidence.length ?? 0) > 0;
      const humanChallenge = (humanElement?.contradictoryEvidence.length ?? 0) > 0;
      const unresolved = element.status === "unresolved" || element.kind === "question";
      const agreement: SharedTheoryAgreement =
        contradictoryEvidence.length > 0
          ? "contested"
          : unresolved
            ? "unresolved"
            : humanSupport && !humanChallenge && coverage.agent
              ? "supported"
              : "partial";
      const lastObservedAt = latestTimestamp(
        [...supportingEvidence, ...contradictoryEvidence].map((reference) => reference.createdAt)
      );
      return {
        theoryElementId: element.id,
        title: element.title,
        kind: element.kind,
        status: element.status,
        agreement,
        coverage,
        supportingEvidence,
        contradictoryEvidence,
        lastObservedAt,
        freshness: memoryFreshness(lastObservedAt, asOf)
      };
    });

  return {
    theoryId: theory.id,
    elements,
    unresolvedTheoryElementIds: elements
      .filter((element) => element.agreement === "unresolved")
      .map((element) => element.theoryElementId),
    contradictionTheoryElementIds: elements
      .filter((element) => element.agreement === "contested")
      .map((element) => element.theoryElementId),
    staleTheoryElementIds: elements
      .filter((element) => element.freshness === "stale")
      .map((element) => element.theoryElementId),
    supportingEvidence: uniqueEvidence(elements.flatMap((element) => element.supportingEvidence)),
    contradictoryEvidence: uniqueEvidence(elements.flatMap((element) => element.contradictoryEvidence))
  };
}
