import { evidenceReference, uniqueEvidence } from "./memoryProjectionSupport";
import type { MemoryEvidenceReference, MemoryProjections } from "./memoryProjectionTypes";
import { evaluateMicroWorld, type MicroWorldProjection, type PredictionChangeDirection } from "./microWorld";
import type { EvidenceEvent, LivingTheory, TheoryElement } from "./types";
import type { UnderstandingCheckProjection } from "./understandingChecks";
import { UNDERSTANDING_GAP_LIMITS, type UnderstandingGap } from "./understandingGapTypes";
import type { FoundryCapability } from "./workspaceEntities";

export interface UnderstandingGapDetectionInput {
  theory: LivingTheory;
  events: EvidenceEvent[];
  memories: MemoryProjections;
  understandingChecks: UnderstandingCheckProjection[];
  microWorlds: MicroWorldProjection[];
  capabilities: FoundryCapability[];
}

const caveat = "This signal describes recorded evidence and workflow state; it does not measure cognition.";

function stableKey(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function referencesForElement(
  element: TheoryElement,
  eventsById: Map<string, EvidenceEvent>,
  rationale: string
): MemoryEvidenceReference[] {
  return element.evidenceEventIds
    .map((eventId) => eventsById.get(eventId))
    .filter((event): event is EvidenceEvent => Boolean(event))
    .map((event) => evidenceReference(event, "mixed", rationale));
}

function createGap(
  gap: Omit<UnderstandingGap, "id" | "status" | "caveat" | "review" | "annotations">
): UnderstandingGap | undefined {
  const evidence = uniqueEvidence(gap.evidence).slice(0, UNDERSTANDING_GAP_LIMITS.evidence);
  if (evidence.length === 0) return undefined;
  const evidenceKey = evidence
    .map((reference) => reference.eventId)
    .sort()
    .join("|");
  const affectedTheoryElementIds = [...new Set(gap.affectedTheoryElementIds)].slice(
    0,
    UNDERSTANDING_GAP_LIMITS.theoryElementIds
  );
  const scopeKey = affectedTheoryElementIds.join("+") || gap.kind;
  return {
    ...gap,
    id: `gap:${gap.kind}:${stableKey(scopeKey)}:${stableKey(evidenceKey)}`,
    title: gap.title.slice(0, UNDERSTANDING_GAP_LIMITS.titleCharacters),
    why: gap.why.slice(0, UNDERSTANDING_GAP_LIMITS.rationaleCharacters),
    severityRationale: gap.severityRationale.slice(0, UNDERSTANDING_GAP_LIMITS.rationaleCharacters),
    affectedTheoryElementIds,
    status: "open",
    caveat,
    evidence,
    annotations: []
  };
}

function lowDimensionGap(
  dimension: "prediction" | "transfer",
  theory: LivingTheory,
  checks: UnderstandingCheckProjection[],
  memories: MemoryProjections,
  eventsById: Map<string, EvidenceEvent>
): UnderstandingGap | undefined {
  const relevantChecks = checks.filter((check) => check.kind === dimension && check.status === "ready");
  const theoryElementIds = [...new Set(relevantChecks.flatMap((check) => check.theoryElementIds))];
  if (theoryElementIds.length === 0) return undefined;
  const projections = memories.human.elements.filter((element) => theoryElementIds.includes(element.theoryElementId));
  const uncoveredTheoryElementIds = projections
    .filter(
      (element) =>
        element.dimensions[dimension].supportingEvidence.length === 0 &&
        element.dimensions[dimension].mixedEvidence.length === 0
    )
    .map((element) => element.theoryElementId);
  if (uncoveredTheoryElementIds.length === 0) return undefined;
  const challengeEvidence = projections
    .filter((element) => uncoveredTheoryElementIds.includes(element.theoryElementId))
    .flatMap((element) => element.dimensions[dimension].contradictoryEvidence);
  const theoryEvidence = theory.elements
    .filter((element) => uncoveredTheoryElementIds.includes(element.id))
    .flatMap((element) =>
      referencesForElement(
        element,
        eventsById,
        `This theory element is in the prepared ${dimension} task, but no usable ${dimension} evidence is recorded.`
      )
    );
  return createGap({
    kind: dimension === "prediction" ? "low_prediction_evidence" : "low_transfer_evidence",
    level: challengeEvidence.length > 0 ? "attention" : "notice",
    title: dimension === "prediction" ? "Prediction evidence is challenged" : "Transfer remains unobserved",
    why:
      challengeEvidence.length > 0
        ? `Recorded ${dimension} evidence currently challenges the relevant theory elements, with no supporting or inspectable mixed evidence.`
        : `A prepared ${dimension} task covers these theory elements, but no durable response has been recorded.`,
    severityRationale:
      challengeEvidence.length > 0
        ? "Attention is warranted because the ledger contains challenge evidence without a counterbalancing observation."
        : "This is a notice because absence of evidence is not evidence of inability.",
    affectedTheoryElementIds: uncoveredTheoryElementIds,
    evidence: [...challengeEvidence, ...theoryEvidence],
    recommendedIntervention: {
      label: dimension === "prediction" ? "Revisit the prediction task" : "Complete the transfer task",
      destination: { kind: "check", view: "learn", id: relevantChecks[0].id }
    }
  });
}

function actualDirection(before: number, after: number): PredictionChangeDirection {
  const tolerance = Math.max(0.001, Math.abs(before) * 0.005);
  if (after > before + tolerance) return "increase";
  if (after < before - tolerance) return "decrease";
  return "unchanged";
}

function microWorldGaps(worlds: MicroWorldProjection[], eventsById: Map<string, EvidenceEvent>): UnderstandingGap[] {
  return worlds.flatMap((world) =>
    world.interactions.flatMap((interaction) => {
      const prediction = world.predictions.find(
        (candidate) => candidate.evidenceEventId === interaction.predictionEventId
      );
      if (!prediction) return [];
      const option = world.prediction.options.find((candidate) => candidate.id === prediction.optionId);
      if (!option) return [];
      const baseline = evaluateMicroWorld(world, prediction.variableValues);
      const mismatches = option.expectedChanges.filter((change) => {
        const before = baseline[change.outcomeId];
        const after = interaction.outcomeValues[change.outcomeId];
        return before === undefined || after === undefined || actualDirection(before, after) !== change.direction;
      });
      if (mismatches.length === 0) return [];
      const reflectionEvents = world.reflections
        .filter((reflection) => reflection.interactionEventId === interaction.evidenceEventId)
        .map((reflection) => eventsById.get(reflection.evidenceEventId))
        .filter((event): event is EvidenceEvent => Boolean(event));
      const predictionEvent = eventsById.get(prediction.evidenceEventId);
      const interactionEvent = eventsById.get(interaction.evidenceEventId);
      if (!predictionEvent || !interactionEvent) return [];
      const affectedTheoryElementIds = [
        ...new Set(
          world.outcomes
            .filter((outcome) => mismatches.some((change) => change.outcomeId === outcome.id))
            .flatMap((outcome) => outcome.theoryElementIds)
        )
      ];
      const gap = createGap({
        kind: "micro_world_mismatch",
        level: reflectionEvents.length > 0 ? "notice" : "attention",
        title: "Prediction differs from the modeled observation",
        why: `${mismatches.length} predicted outcome ${mismatches.length === 1 ? "direction does" : "directions do"} not match the recorded model output.`,
        severityRationale:
          reflectionEvents.length > 0
            ? "A linked reflection is present, so the mismatch is retained as a notice for comparison."
            : "Attention is warranted until the learner records how they interpret the mismatch.",
        affectedTheoryElementIds,
        evidence: [
          evidenceReference(predictionEvent, "mixed", "This event records the learner's prediction before reveal."),
          evidenceReference(
            interactionEvent,
            "challenges",
            "This separate event records the modeled outcomes for the changed configuration."
          ),
          ...reflectionEvents.map((event) =>
            evidenceReference(event, "mixed", "This reflection is causally linked to the recorded interaction.")
          )
        ],
        recommendedIntervention: {
          label: "Compare the prediction and model limits",
          destination: { kind: "micro-world", view: "learn", id: world.id }
        }
      });
      return gap ? [gap] : [];
    })
  );
}

export function detectUnderstandingGaps(input: UnderstandingGapDetectionInput): UnderstandingGap[] {
  const eventsById = new Map(input.events.map((event) => [event.id, event]));
  const sharedById = new Map(input.memories.shared.elements.map((element) => [element.theoryElementId, element]));
  const humanById = new Map(input.memories.human.elements.map((element) => [element.theoryElementId, element]));
  const gaps: Array<UnderstandingGap | undefined> = [];

  for (const decision of input.theory.elements.filter(
    (element) => element.kind === "decision" && element.status !== "superseded"
  )) {
    const explanation = humanById.get(decision.id)?.dimensions.explanation;
    const explanationRelationships = input.theory.relationships.filter(
      (relationship) =>
        relationship.kind === "decision-because" &&
        (relationship.fromElementId === decision.id || relationship.toElementId === decision.id)
    );
    const relationshipEvents = explanationRelationships.flatMap((relationship) =>
      relationship.evidenceEventIds
        .map((eventId) => eventsById.get(eventId))
        .filter((event): event is EvidenceEvent => Boolean(event))
    );
    const humanRelationshipEvents = relationshipEvents.filter((event) => event.actor === "human");
    if (
      (explanation?.supportingEvidence.length ?? 0) + (explanation?.mixedEvidence.length ?? 0) > 0 ||
      humanRelationshipEvents.length > 0
    ) {
      continue;
    }
    const agentRelationshipEvidence = relationshipEvents
      .filter((event) => event.actor !== "human")
      .map((event) =>
        evidenceReference(
          event,
          "mixed",
          "This canonical relationship records a rationale, but it is not a human-authored explanation."
        )
      );
    gaps.push(
      createGap({
        kind: "unexplained_decision",
        level: "attention",
        title: `Decision lacks an inspectable explanation: ${decision.title}`,
        why:
          agentRelationshipEvidence.length > 0
            ? "The Living Theory records a decision rationale, but the linked explanation is agent-authored and has not been inspected by the human."
            : "The Living Theory records a decision, but no human explanation evidence is linked to it.",
        severityRationale: "Decisions can guide later work, so an unexplained rationale deserves attention.",
        affectedTheoryElementIds: [decision.id],
        evidence: [
          ...referencesForElement(
            decision,
            eventsById,
            "This event introduced the decision whose explanation is absent."
          ),
          ...agentRelationshipEvidence
        ],
        recommendedIntervention: {
          label: "Inspect the decision and add a rationale",
          destination: { kind: "theory-element", view: "memory", id: decision.id }
        }
      })
    );
  }

  for (const element of input.memories.shared.elements.filter((candidate) => candidate.freshness === "stale")) {
    gaps.push(
      createGap({
        kind: "stale_theory",
        level: "notice",
        title: `Theory evidence is stale: ${element.title}`,
        why: "The latest linked evidence falls outside the current recency window.",
        severityRationale: "Staleness is a review prompt, not proof that the theory is wrong.",
        affectedTheoryElementIds: [element.theoryElementId],
        evidence: [...element.supportingEvidence, ...element.contradictoryEvidence],
        recommendedIntervention: {
          label: "Review current supporting evidence",
          destination: { kind: "theory-element", view: "memory", id: element.theoryElementId }
        }
      })
    );
  }

  gaps.push(
    lowDimensionGap("prediction", input.theory, input.understandingChecks, input.memories, eventsById),
    lowDimensionGap("transfer", input.theory, input.understandingChecks, input.memories, eventsById)
  );

  for (const capability of input.capabilities.filter(
    (candidate) => candidate.manifest.status === "revised" && !candidate.evaluation
  )) {
    const version = input.memories.agent.capabilityVersions.find(
      (candidate) => candidate.capabilityId === capability.manifest.id
    );
    const event = version?.evidenceEventId ? eventsById.get(version.evidenceEventId) : undefined;
    gaps.push(
      event
        ? createGap({
            kind: "black_box_capability_revision",
            level: "priority",
            title: `Revised capability lacks evaluation: ${capability.manifest.name}`,
            why: "A revised capability version is recorded without evaluation evidence for that version.",
            severityRationale:
              "Priority is warranted because capability activation must not rely on an opaque revision.",
            affectedTheoryElementIds: [],
            evidence: [evidenceReference(event, "challenges", "This event registered the unevaluated revision.")],
            recommendedIntervention: {
              label: "Evaluate the revised capability",
              destination: { kind: "capability", view: "foundry", id: capability.manifest.id }
            }
          })
        : undefined
    );
  }

  for (const element of input.memories.shared.elements.filter((candidate) => candidate.agreement === "contested")) {
    gaps.push(
      createGap({
        kind: "unresolved_contradiction",
        level: "priority",
        title: `Contradiction remains unresolved: ${element.title}`,
        why: "The shared theory contains explicit contradictory evidence with no resolving revision.",
        severityRationale: "Priority is warranted when conflicting claims can guide the same decision.",
        affectedTheoryElementIds: [element.theoryElementId],
        evidence: element.contradictoryEvidence,
        recommendedIntervention: {
          label: "Inspect and revise the contradiction",
          destination: { kind: "theory-element", view: "memory", id: element.theoryElementId }
        }
      })
    );
  }

  for (const relationship of input.theory.relationships.filter((candidate) => candidate.kind === "depends-on")) {
    const affected = [relationship.fromElementId, relationship.toElementId].filter((elementId) => {
      const coverage = sharedById.get(elementId)?.coverage;
      return coverage?.agent && !coverage.human;
    });
    if (affected.length === 0) continue;
    const evidence = relationship.evidenceEventIds
      .map((eventId) => eventsById.get(eventId))
      .filter((event): event is EvidenceEvent => Boolean(event))
      .map((event) =>
        evidenceReference(
          event,
          "mixed",
          "This dependency is represented in agent-authored evidence without human evidence."
        )
      );
    gaps.push(
      createGap({
        kind: "agent_only_dependency",
        level: "attention",
        title: "A dependency is represented only on the agent side",
        why: "A declared dependency touches theory elements with agent coverage but no human evidence coverage.",
        severityRationale: "Attention is warranted because the dependency can shape action without shared inspection.",
        affectedTheoryElementIds: affected,
        evidence,
        recommendedIntervention: {
          label: "Inspect the dependency evidence",
          destination: { kind: "theory-element", view: "memory", id: affected[0] }
        }
      })
    );
  }

  return [
    ...gaps.filter((gap): gap is UnderstandingGap => Boolean(gap)),
    ...microWorldGaps(input.microWorlds, eventsById)
  ];
}
