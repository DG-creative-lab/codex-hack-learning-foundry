import {
  capabilityActivationPayloadSchema,
  capabilityDecisionPayloadSchema,
  capabilityEvaluationPayloadSchema,
  capabilityExecutionPayloadSchema,
  capabilityRegisteredPayloadSchema,
  capabilitySupersededPayloadSchema,
  deriveCapabilityGate,
  type FoundryCapability,
  foundryCapabilitySchema
} from "./capability";
import type { EvidenceEvent } from "./types";
import type { UnderstandingCheckProjection } from "./understandingChecks";

interface CapabilityProjectionContext {
  sourceIds: Set<string>;
  theoryElementIds: Set<string>;
  understandingChecks: UnderstandingCheckProjection[];
}

function requireKnownIds(entity: string, ids: string[], knownIds: Set<string>, kind: string) {
  const unknownId = ids.find((id) => !knownIds.has(id));
  if (unknownId) throw new Error(`${entity} references unknown ${kind} ${unknownId}`);
}

function requireEventSources(event: EvidenceEvent, capability: FoundryCapability) {
  const missingSourceId = capability.manifest.sourceIds.find((sourceId) => !event.sourceIds.includes(sourceId));
  if (missingSourceId) throw new Error(`Capability event ${event.id} is missing provenance for ${missingSourceId}`);
}

function sameIds(left: string[], right: string[]) {
  return left.length === right.length && left.every((id) => right.includes(id));
}

function gateEvidenceEventIds(capability: FoundryCapability) {
  return [
    ...new Set(
      capability.gate.requirements
        .filter((requirement) => requirement.id !== "human_approval")
        .flatMap((requirement) => requirement.evidenceEventIds)
    )
  ];
}

function withStatus(capability: FoundryCapability, status: FoundryCapability["manifest"]["status"]): FoundryCapability {
  return { ...capability, manifest: { ...capability.manifest, status } };
}

export function deriveCapabilities(events: EvidenceEvent[], context: CapabilityProjectionContext): FoundryCapability[] {
  const capabilities = new Map<string, FoundryCapability>();
  const eventOrder = new Map(events.map((event, index) => [event.id, index]));

  for (const [eventIndex, event] of events.entries()) {
    if (event.type === "capability.registered") {
      if (event.actor !== "agent" || event.kind !== "agent_synthesis") {
        throw new Error(`Capability registration ${event.id} must be recorded as agent synthesis`);
      }
      const { manifest } = capabilityRegisteredPayloadSchema.parse(event.payload);
      if (manifest.status !== "draft") throw new Error(`Capability ${manifest.id} must be registered as draft`);
      if (capabilities.has(manifest.id)) throw new Error(`Capability ID ${manifest.id} is duplicated`);
      if (manifest.supersedesCapabilityId && !capabilities.has(manifest.supersedesCapabilityId)) {
        throw new Error(`Capability ${manifest.id} supersedes unknown capability ${manifest.supersedesCapabilityId}`);
      }
      requireKnownIds(`Capability ${manifest.id}`, manifest.sourceIds, context.sourceIds, "source");
      requireKnownIds(
        `Capability ${manifest.id}`,
        manifest.theoryElementIds,
        context.theoryElementIds,
        "theory element"
      );
      const provisional = {
        manifest,
        registrationEventId: event.id,
        evaluation: null,
        decision: null,
        activation: null,
        executions: 0
      };
      const capability: FoundryCapability = {
        ...provisional,
        gate: deriveCapabilityGate({ capability: provisional, understandingChecks: context.understandingChecks })
      };
      requireEventSources(event, capability);
      capabilities.set(manifest.id, capability);
      continue;
    }

    if (!event.type.startsWith("capability.")) continue;
    const capabilityId = typeof event.payload.capabilityId === "string" ? event.payload.capabilityId : undefined;
    if (!capabilityId) throw new Error(`Capability event ${event.id} is missing a capability ID`);
    const capability = capabilities.get(capabilityId);
    if (!capability) throw new Error(`Capability event ${event.id} references unknown capability ${capabilityId}`);
    requireEventSources(event, capability);

    if (event.type === "capability.evaluation_recorded") {
      if (event.actor !== "system" || event.kind !== "validated_behavior") {
        throw new Error(`Capability evaluation ${event.id} must be recorded as validated system behavior`);
      }
      if (!["draft", "evaluated"].includes(capability.manifest.status)) {
        throw new Error(`Capability ${capabilityId} cannot be evaluated from ${capability.manifest.status}`);
      }
      const { evaluation } = capabilityEvaluationPayloadSchema.parse(event.payload);
      const declaredCaseIds = capability.manifest.evaluationCases.map((evaluationCase) => evaluationCase.id);
      const resultCaseIds = evaluation.cases.map((result) => result.caseId);
      if (!sameIds(declaredCaseIds, resultCaseIds)) {
        throw new Error(`Capability evaluation ${event.id} does not match its declared case manifest`);
      }
      for (const result of evaluation.cases) {
        const declaredCase = capability.manifest.evaluationCases.find((candidate) => candidate.id === result.caseId);
        if (!declaredCase || !result.sourceIds.every((sourceId) => declaredCase.sourceIds.includes(sourceId))) {
          throw new Error(`Capability evaluation case ${result.caseId} has undeclared source evidence`);
        }
      }
      const evaluated = withStatus(
        {
          ...capability,
          evaluation: { result: evaluation, evidenceEventId: event.id, createdAt: event.createdAt }
        },
        "evaluated"
      );
      capabilities.set(capabilityId, {
        ...evaluated,
        gate: deriveCapabilityGate({ capability: evaluated, understandingChecks: context.understandingChecks })
      });
      continue;
    }

    if (event.type === "capability.activation_decided") {
      if (event.actor !== "human" || event.kind !== "user_interpretation") {
        throw new Error(`Capability decision ${event.id} must be recorded as a human interpretation`);
      }
      if (capability.manifest.status !== "evaluated" || capability.decision) {
        throw new Error(`Capability ${capabilityId} cannot be decided from ${capability.manifest.status}`);
      }
      const decision = capabilityDecisionPayloadSchema.parse(event.payload);
      const gate = deriveCapabilityGate({
        capability,
        understandingChecks: context.understandingChecks,
        eventOrder,
        beforeEventIndex: eventIndex
      });
      if (decision.decision === "approved" && !gate.approvalReady) {
        throw new Error(`Capability ${capabilityId} cannot be approved while activation requirements are unmet`);
      }
      const expectedEvidenceEventIds = gateEvidenceEventIds({ ...capability, gate });
      if (!sameIds(decision.gateEvidenceEventIds, expectedEvidenceEventIds)) {
        throw new Error(`Capability decision ${event.id} does not declare its exact gate evidence`);
      }
      const decided = withStatus(
        {
          ...capability,
          decision: { payload: decision, evidenceEventId: event.id, createdAt: event.createdAt }
        },
        decision.decision === "approved" ? "approved" : "rejected"
      );
      capabilities.set(capabilityId, {
        ...decided,
        gate: deriveCapabilityGate({ capability: decided, understandingChecks: context.understandingChecks })
      });
      continue;
    }

    if (event.type === "capability.activated") {
      if (event.actor !== "human" || event.kind !== "user_interpretation") {
        throw new Error(`Capability activation ${event.id} must be explicitly recorded by a human`);
      }
      if (capability.manifest.status !== "approved" || capability.decision?.payload.decision !== "approved") {
        throw new Error(`Capability ${capabilityId} cannot activate without approval`);
      }
      const activation = capabilityActivationPayloadSchema.parse(event.payload);
      if (activation.approvalEventId !== capability.decision.evidenceEventId) {
        throw new Error(`Capability activation ${event.id} does not reference its approval event`);
      }
      const gate = deriveCapabilityGate({
        capability,
        understandingChecks: context.understandingChecks,
        eventOrder,
        beforeEventIndex: eventIndex
      });
      if (!gate.activationReady)
        throw new Error(`Capability ${capabilityId} cannot activate while its gate is blocked`);
      const active = withStatus(
        {
          ...capability,
          activation: { payload: activation, evidenceEventId: event.id, createdAt: event.createdAt }
        },
        "active"
      );
      capabilities.set(capabilityId, { ...active, gate });
      continue;
    }

    if (event.type === "capability.executed") {
      if (capability.manifest.status !== "active") {
        throw new Error(`Capability ${capabilityId} cannot execute from ${capability.manifest.status}`);
      }
      capabilityExecutionPayloadSchema.parse(event.payload);
      capabilities.set(capabilityId, { ...capability, executions: capability.executions + 1 });
      continue;
    }

    if (event.type === "capability.superseded") {
      if (event.actor !== "human" || event.kind !== "user_interpretation") {
        throw new Error(`Capability supersession ${event.id} must be recorded by a human`);
      }
      const { replacementCapabilityId } = capabilitySupersededPayloadSchema.parse(event.payload);
      if (!capabilities.has(replacementCapabilityId)) {
        throw new Error(
          `Capability ${capabilityId} cannot be superseded by unknown capability ${replacementCapabilityId}`
        );
      }
      const replacement = capabilities.get(replacementCapabilityId);
      if (replacement?.manifest.supersedesCapabilityId !== capabilityId) {
        throw new Error(`Capability ${replacementCapabilityId} is not registered as a revision of ${capabilityId}`);
      }
      capabilities.set(capabilityId, withStatus(capability, "superseded"));
      continue;
    }

    throw new Error(`Unsupported capability event ${event.type}`);
  }

  return foundryCapabilitySchema.array().parse(
    [...capabilities.values()].map((capability) => ({
      ...capability,
      gate: deriveCapabilityGate({ capability, understandingChecks: context.understandingChecks })
    }))
  );
}
