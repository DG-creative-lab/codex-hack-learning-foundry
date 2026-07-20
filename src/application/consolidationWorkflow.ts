import type { FoundryCapability } from "../domain/capability";
import {
  type ConsolidationProposalProjection,
  consolidationProposedPayloadSchema,
  consolidationReviewPayloadSchema,
  generateConsolidationProposal
} from "../domain/consolidation";
import {
  type MicroWorldProjection,
  microWorldInteractionPayloadSchema,
  microWorldReflectionPayloadSchema
} from "../domain/microWorld";
import {
  type PracticalFeedbackKind,
  type PracticalOutcome,
  practicalApplicationPayloadSchema,
  practicalFeedbackEventType,
  practicalFeedbackPayloadSchema
} from "../domain/practicalEvidence";
import type { EvidenceEvent, LivingTheory } from "../domain/types";
import type { UnderstandingCheckProjection } from "../domain/understandingChecks";

interface ConsolidationWorkflowDependencies {
  append: (event: EvidenceEvent) => Promise<unknown>;
  resolveCapability: (capabilityId: string) => FoundryCapability | undefined;
  resolveEvent: (eventId: string) => EvidenceEvent | undefined;
  resolveMicroWorld: (artifactId: string) => MicroWorldProjection | undefined;
  resolveProposal: (proposalId: string) => ConsolidationProposalProjection | undefined;
  theory: LivingTheory;
  capabilities: FoundryCapability[];
  checks: UnderstandingCheckProjection[];
  microWorlds: MicroWorldProjection[];
  now?: () => string;
  createId?: (prefix: string) => string;
}

function defaultId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
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

export function createConsolidationWorkflow(dependencies: ConsolidationWorkflowDependencies) {
  const now = dependencies.now ?? (() => new Date().toISOString());
  const createId = dependencies.createId ?? defaultId;

  async function applyCapability(
    capabilityId: string,
    inputSummary: string,
    outputSummary: string,
    outcome: PracticalOutcome
  ) {
    const capability = dependencies.resolveCapability(capabilityId);
    if (!capability) throw new Error(`Cannot apply unknown capability ${capabilityId}`);
    if (capability.manifest.status !== "active") {
      throw new Error(`Capability ${capabilityId} cannot be applied from ${capability.manifest.status}`);
    }
    const payload = practicalApplicationPayloadSchema.parse({
      capabilityId,
      capabilityVersion: capability.manifest.version,
      inputSummary,
      outputSummary,
      outcome,
      theoryElementIds: capability.manifest.theoryElementIds
    });
    const event: EvidenceEvent = {
      id: createId("evt-practical-application"),
      type: "practical.application_recorded",
      kind: "practical_observation",
      createdAt: now(),
      actor: "agent",
      summary: `Applied ${capability.manifest.name} and recorded a ${outcome} result.`,
      sourceIds: capability.manifest.sourceIds,
      payload
    };
    await dependencies.append(event);
    return event.id;
  }

  function subjectContext(subject: EvidenceEvent) {
    if (subject.type === "practical.application_recorded") {
      const application = practicalApplicationPayloadSchema.parse(subject.payload);
      return {
        capabilityId: application.capabilityId,
        theoryElementIds: application.theoryElementIds,
        sourceIds: subject.sourceIds
      };
    }
    if (subject.type === "learning.micro_world_interaction_recorded") {
      const { artifactId } = microWorldInteractionPayloadSchema.parse(subject.payload);
      const world = dependencies.resolveMicroWorld(artifactId);
      if (!world) throw new Error(`Cannot record feedback for unknown micro-world ${artifactId}`);
      return { theoryElementIds: world.theoryElementIds, sourceIds: world.sourceIds };
    }
    if (subject.type === "learning.micro_world_reflection_recorded") {
      const { artifactId } = microWorldReflectionPayloadSchema.parse(subject.payload);
      const world = dependencies.resolveMicroWorld(artifactId);
      if (!world) throw new Error(`Cannot record feedback for unknown micro-world ${artifactId}`);
      return { theoryElementIds: world.theoryElementIds, sourceIds: world.sourceIds };
    }
    throw new Error(`Evidence event ${subject.id} is not eligible for practical feedback`);
  }

  async function recordFeedback(subjectEventId: string, kind: PracticalFeedbackKind, content: string) {
    const subject = dependencies.resolveEvent(subjectEventId);
    if (!subject) throw new Error(`Cannot record feedback for unknown evidence ${subjectEventId}`);
    const context = subjectContext(subject);
    const payload = practicalFeedbackPayloadSchema.parse({
      subjectEventId,
      capabilityId: context.capabilityId,
      kind,
      content,
      theoryElementIds: context.theoryElementIds
    });
    const event: EvidenceEvent = {
      id: createId(`evt-practical-${kind}`),
      type: practicalFeedbackEventType(kind),
      kind: kind === "correction" ? "user_interpretation" : "practical_observation",
      createdAt: now(),
      actor: "human",
      summary: `Recorded practical ${kind} evidence.`,
      sourceIds: context.sourceIds,
      payload
    };
    await dependencies.append(event);
    return event.id;
  }

  async function propose(triggerEventIds: string[]) {
    const triggerEvents = triggerEventIds.map((eventId) => {
      const event = dependencies.resolveEvent(eventId);
      if (!event) throw new Error(`Cannot consolidate unknown evidence ${eventId}`);
      return event;
    });
    const createdAt = now();
    const proposal = generateConsolidationProposal({
      proposalId: createId("consolidation"),
      createdAt,
      triggerEvents,
      theory: dependencies.theory,
      capabilities: dependencies.capabilities,
      checks: dependencies.checks,
      microWorlds: dependencies.microWorlds
    });
    const payload = consolidationProposedPayloadSchema.parse({ proposal });
    const sourceIds = [
      ...new Set([
        ...triggerEvents.flatMap((event) => event.sourceIds),
        ...proposal.reviewItems.flatMap((item) => item.sourceIds),
        ...proposal.theoryRevisions.flatMap((revision) => revision.sourceIds),
        ...proposal.capabilityRevisions.flatMap((revision) => revision.sourceIds)
      ])
    ];
    const event: EvidenceEvent = {
      id: createId("evt-consolidation-proposal"),
      type: "consolidation.proposed",
      kind: "agent_synthesis",
      createdAt,
      actor: "agent",
      summary: "Proposed traceable learning and capability revisions from practical evidence.",
      sourceIds,
      payload
    };
    await dependencies.append(event);
    return proposal.id;
  }

  async function review(proposalId: string, decision: "approved" | "rejected", reason: string) {
    const proposal = dependencies.resolveProposal(proposalId);
    if (!proposal) throw new Error(`Cannot review unknown consolidation proposal ${proposalId}`);
    if (proposal.status !== "pending") throw new Error(`Consolidation proposal ${proposalId} was already reviewed`);
    const payload = consolidationReviewPayloadSchema.parse({ proposalId, decision, reason });
    const event: EvidenceEvent = {
      id: createId("evt-consolidation-review"),
      type: "consolidation.reviewed",
      kind: "user_interpretation",
      createdAt: now(),
      actor: "human",
      summary: `${decision === "approved" ? "Approved" : "Rejected"} consolidation proposal ${proposalId}.`,
      sourceIds: proposalSourceIds(proposal),
      payload
    };
    await dependencies.append(event);
  }

  return { applyCapability, recordFeedback, propose, review };
}

export type ConsolidationWorkflow = ReturnType<typeof createConsolidationWorkflow>;
