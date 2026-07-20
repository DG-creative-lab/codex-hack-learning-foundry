import {
  capabilityActivationPayloadSchema,
  capabilityDecisionPayloadSchema,
  type FoundryCapability
} from "../domain/capability";
import type { EvidenceEvent } from "../domain/types";

interface CapabilityWorkflowDependencies {
  append: (event: EvidenceEvent) => Promise<unknown>;
  resolveCapability: (capabilityId: string) => FoundryCapability | undefined;
  now?: () => string;
  createId?: (prefix: string) => string;
}

function defaultId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function requiredGateEvidence(capability: FoundryCapability) {
  return [
    ...new Set(
      capability.gate.requirements
        .filter((requirement) => requirement.id !== "human_approval")
        .flatMap((requirement) => requirement.evidenceEventIds)
    )
  ];
}

export function createCapabilityWorkflow(dependencies: CapabilityWorkflowDependencies) {
  const now = dependencies.now ?? (() => new Date().toISOString());
  const createId = dependencies.createId ?? defaultId;

  async function approve(capabilityId: string, reason: string) {
    const capability = dependencies.resolveCapability(capabilityId);
    if (!capability) throw new Error(`Cannot approve unknown capability ${capabilityId}`);
    if (capability.manifest.status !== "evaluated" || capability.decision) {
      throw new Error(`Capability ${capabilityId} cannot be approved from ${capability.manifest.status}`);
    }
    if (!capability.gate.approvalReady) throw new Error(`Capability ${capabilityId} has unmet approval requirements`);
    const payload = capabilityDecisionPayloadSchema.parse({
      capabilityId,
      decision: "approved",
      reason,
      gateEvidenceEventIds: requiredGateEvidence(capability)
    });
    const event: EvidenceEvent = {
      id: createId("evt-capability-approval"),
      type: "capability.activation_decided",
      kind: "user_interpretation",
      createdAt: now(),
      actor: "human",
      summary: `Approved ${capability.manifest.name} for deliberate activation.`,
      sourceIds: capability.manifest.sourceIds,
      payload
    };
    await dependencies.append(event);
  }

  async function reject(capabilityId: string, reason: string, revisionRequest: string) {
    const capability = dependencies.resolveCapability(capabilityId);
    if (!capability) throw new Error(`Cannot reject unknown capability ${capabilityId}`);
    if (capability.manifest.status !== "evaluated" || capability.decision) {
      throw new Error(`Capability ${capabilityId} cannot be rejected from ${capability.manifest.status}`);
    }
    const payload = capabilityDecisionPayloadSchema.parse({
      capabilityId,
      decision: "rejected",
      reason,
      revisionRequest,
      gateEvidenceEventIds: requiredGateEvidence(capability)
    });
    const event: EvidenceEvent = {
      id: createId("evt-capability-rejection"),
      type: "capability.activation_decided",
      kind: "user_interpretation",
      createdAt: now(),
      actor: "human",
      summary: `Rejected ${capability.manifest.name} and requested a revision.`,
      sourceIds: capability.manifest.sourceIds,
      payload
    };
    await dependencies.append(event);
  }

  async function activate(capabilityId: string, reason: string) {
    const capability = dependencies.resolveCapability(capabilityId);
    if (!capability) throw new Error(`Cannot activate unknown capability ${capabilityId}`);
    if (capability.manifest.status !== "approved" || capability.decision?.payload.decision !== "approved") {
      throw new Error(`Capability ${capabilityId} cannot activate without explicit approval`);
    }
    if (!capability.gate.activationReady)
      throw new Error(`Capability ${capabilityId} has unmet activation requirements`);
    const payload = capabilityActivationPayloadSchema.parse({
      capabilityId,
      approvalEventId: capability.decision.evidenceEventId,
      reason
    });
    const event: EvidenceEvent = {
      id: createId("evt-capability-activation"),
      type: "capability.activated",
      kind: "user_interpretation",
      createdAt: now(),
      actor: "human",
      summary: `Activated ${capability.manifest.name} after explicit approval.`,
      sourceIds: capability.manifest.sourceIds,
      payload
    };
    await dependencies.append(event);
  }

  return { approve, reject, activate };
}

export type CapabilityWorkflow = ReturnType<typeof createCapabilityWorkflow>;
