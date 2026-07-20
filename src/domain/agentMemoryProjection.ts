import { evidenceReference, latestTimestamp, memoryFreshness, uniqueEvidence } from "./memoryProjectionSupport";
import type {
  AgentCapabilityEvaluation,
  AgentFailure,
  AgentMemoryProjection,
  AgentTheoryMemoryItem,
  MemoryEvidenceReference
} from "./memoryProjectionTypes";
import { practicalApplicationPayloadSchema, practicalFeedbackPayloadSchema } from "./practicalEvidence";
import type { EvidenceEvent, LivingTheory, TheoryElement } from "./types";
import type { UnderstandingSignal } from "./understandingChecks";
import {
  capabilityEvaluationPayloadSchema,
  capabilityRegisteredPayloadSchema,
  type FoundryCapability
} from "./workspaceEntities";

function eventTimes(element: TheoryElement, eventsById: Map<string, EvidenceEvent>): string[] {
  return element.evidenceEventIds
    .map((eventId) => eventsById.get(eventId)?.createdAt)
    .filter((value): value is string => Boolean(value));
}

function theoryItem(
  element: TheoryElement,
  eventsById: Map<string, EvidenceEvent>,
  asOf: string
): AgentTheoryMemoryItem {
  const lastObservedAt = latestTimestamp(eventTimes(element, eventsById));
  return {
    theoryElementId: element.id,
    title: element.title,
    kind: element.kind,
    sourceIds: element.sourceIds,
    evidenceEventIds: element.evidenceEventIds,
    lastObservedAt,
    freshness: memoryFreshness(lastObservedAt, asOf)
  };
}

function capabilityIdFromEvent(event: EvidenceEvent): string | undefined {
  const value = event.payload.capabilityId;
  if (typeof value === "string") return value;
  if (event.type === "capability.registered") return capabilityRegisteredPayloadSchema.parse(event.payload).manifest.id;
  return undefined;
}

export function deriveAgentMemory(
  theory: LivingTheory,
  events: EvidenceEvent[],
  eventsById: Map<string, EvidenceEvent>,
  capabilities: FoundryCapability[],
  asOf: string
): AgentMemoryProjection {
  const activeElements = theory.elements.filter((element) => element.status !== "superseded");
  const items = activeElements.map((element) => theoryItem(element, eventsById, asOf));
  const agentEventIds = new Set(events.filter((event) => event.actor === "agent").map((event) => event.id));
  const evaluations: AgentCapabilityEvaluation[] = [];
  const failures: AgentFailure[] = [];
  const supportingEvidence: MemoryEvidenceReference[] = [];
  const contradictoryEvidence: MemoryEvidenceReference[] = [];

  for (const event of events) {
    if (event.type === "capability.evaluation_recorded") {
      const { capabilityId, evaluation } = capabilityEvaluationPayloadSchema.parse(event.payload);
      const failedCases = evaluation.total - evaluation.passed;
      const signal: UnderstandingSignal =
        failedCases === 0 ? "supports" : evaluation.passed === 0 ? "challenges" : "mixed";
      const reference = evidenceReference(
        event,
        signal,
        failedCases === 0
          ? "All declared evaluation cases passed."
          : `${failedCases} of ${evaluation.total} declared evaluation cases failed.`
      );
      evaluations.push({
        capabilityId,
        passed: evaluation.passed,
        total: evaluation.total,
        evidence: reference,
        freshness: memoryFreshness(event.createdAt, asOf)
      });
      if (failedCases === 0) supportingEvidence.push(reference);
      else {
        contradictoryEvidence.push(reference);
        failures.push({ capabilityId, failedCases, evidence: reference });
      }
    }
    if (event.type.startsWith("capability.") && /(failed|rejected)/.test(event.type)) {
      const reference = evidenceReference(event, "challenges", "A capability failure or rejection was recorded.");
      contradictoryEvidence.push(reference);
      failures.push({ capabilityId: capabilityIdFromEvent(event), evidence: reference });
    }
    if (event.type === "practical.application_recorded") {
      const application = practicalApplicationPayloadSchema.parse(event.payload);
      const signal: UnderstandingSignal = application.outcome === "successful" ? "supports" : "challenges";
      const reference = evidenceReference(
        event,
        signal,
        application.outcome === "successful"
          ? "A recorded application completed successfully."
          : `A recorded application had a ${application.outcome} outcome.`
      );
      if (application.outcome === "successful") supportingEvidence.push(reference);
      else {
        contradictoryEvidence.push(reference);
        failures.push({ capabilityId: application.capabilityId, evidence: reference });
      }
    }
    if (["practical.correction_recorded", "practical.failure_recorded"].includes(event.type)) {
      const feedback = practicalFeedbackPayloadSchema.parse(event.payload);
      const reference = evidenceReference(
        event,
        "challenges",
        feedback.kind === "correction"
          ? "Human practical feedback corrected the capability's recorded behavior."
          : "Human practical feedback recorded a capability failure."
      );
      contradictoryEvidence.push(reference);
      failures.push({ capabilityId: feedback.capabilityId, evidence: reference });
    }
  }

  const capabilityVersions = capabilities.map((capability) => {
    const event = events.find(
      (candidate) =>
        candidate.type === "capability.registered" && capabilityIdFromEvent(candidate) === capability.manifest.id
    );
    return {
      capabilityId: capability.manifest.id,
      name: capability.manifest.name,
      version: capability.manifest.version,
      status: capability.manifest.status,
      evidenceEventId: event?.id,
      createdAt: capability.manifest.createdAt,
      freshness: memoryFreshness(capability.manifest.createdAt, asOf)
    };
  });

  const theorySupport = activeElements.flatMap((element) =>
    element.evidenceEventIds
      .map((eventId) => eventsById.get(eventId))
      .filter((event): event is EvidenceEvent => Boolean(event))
      .filter((event) => event.actor === "agent" || event.kind === "source_fact")
      .map((event) => evidenceReference(event, "supports", "Evidence contributes to the agent's accessible theory."))
  );
  const theoryContradictions = activeElements
    .filter((element) => element.kind === "contradiction")
    .flatMap((element) =>
      element.evidenceEventIds
        .map((eventId) => eventsById.get(eventId))
        .filter((event): event is EvidenceEvent => Boolean(event))
        .map((event) => evidenceReference(event, "challenges", "The Living Theory records a contradiction."))
    );

  return {
    theoryId: theory.id,
    theoryElementIds: activeElements.map((element) => element.id),
    contributedTheoryElementIds: activeElements
      .filter((element) => element.evidenceEventIds.some((eventId) => agentEventIds.has(eventId)))
      .map((element) => element.id),
    knowledge: items.filter((item) => ["purpose", "concept", "claim", "causal_model"].includes(item.kind)),
    assumptions: items.filter((item) => item.kind === "assumption"),
    boundaries: items.filter((item) => item.kind === "boundary"),
    decisions: items.filter((item) => item.kind === "decision"),
    evaluations,
    failures,
    capabilityVersions,
    supportingEvidence: uniqueEvidence([...theorySupport, ...supportingEvidence]),
    contradictoryEvidence: uniqueEvidence([...theoryContradictions, ...contradictoryEvidence]),
    staleTheoryElementIds: items.filter((item) => item.freshness === "stale").map((item) => item.theoryElementId)
  };
}
