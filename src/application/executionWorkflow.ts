import { executionAdapterIdSchema, executionPromptBoundarySchema } from "../../shared/execution-contract.js";
import type { FoundryCapability } from "../domain/capability";
import { practicalApplicationPayloadSchema } from "../domain/practicalEvidence";
import type { EvidenceEvent } from "../domain/types";
import type { ExecutionAdapter, ExecutionAdapterId, ExecutionAttemptResult } from "./executionAdapters";

interface ExecutionWorkflowDependencies {
  append: (event: EvidenceEvent) => Promise<unknown>;
  resolveCapability: (capabilityId: string) => FoundryCapability | undefined;
  adapters: ExecutionAdapter[];
  now?: () => string;
  createId?: (prefix: string) => string;
}

function defaultId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function boundedContext(values: string[]) {
  return (values.join("\n") || "None declared.").slice(0, 2400);
}

function promptBoundary(capability: FoundryCapability) {
  return executionPromptBoundarySchema.parse({
    instruction: `Apply ${capability.manifest.name} version ${capability.manifest.version} to the supplied task. Produce a concise result grounded in its declared evaluation cases.`,
    contextSections: [
      { label: "Capability", content: `${capability.manifest.name} (${capability.manifest.type})` },
      { label: "Declared assumptions", content: boundedContext(capability.manifest.assumptions) },
      { label: "Operating boundaries", content: boundedContext(capability.manifest.operatingBoundaries) },
      {
        label: "Evaluation expectations",
        content: boundedContext(capability.manifest.evaluationCases.map((item) => `${item.title}: ${item.expectation}`))
      },
      { label: "Capability artifact", content: capability.manifest.skillPath }
    ],
    excludedContext: ["API credentials", "private desktop activity", "unapproved sources", "canonical ledger contents"]
  });
}

function canonicalAttempt(attempt: ExecutionAttemptResult) {
  return {
    adapter: attempt.adapter,
    status: attempt.status,
    startedAt: attempt.startedAt,
    completedAt: attempt.completedAt,
    durationMs: attempt.durationMs,
    adapterVersion: attempt.adapterVersion,
    ...(attempt.error ? { error: attempt.error } : {})
  };
}

export function createExecutionWorkflow(dependencies: ExecutionWorkflowDependencies) {
  const now = dependencies.now ?? (() => new Date().toISOString());
  const createId = dependencies.createId ?? defaultId;
  const adapters = new Map(dependencies.adapters.map((adapter) => [adapter.id, adapter]));
  const prepared = adapters.get("prepared");
  if (!prepared) throw new Error("The prepared execution adapter is required.");
  const preparedAdapter = prepared;

  async function availability(adapterId: ExecutionAdapterId) {
    const adapter = adapters.get(executionAdapterIdSchema.parse(adapterId));
    if (!adapter) throw new Error(`Execution adapter ${adapterId} is not registered.`);
    return adapter.availability();
  }

  async function executeCapability(
    capabilityId: string,
    inputSummary: string,
    requestedAdapter: ExecutionAdapterId,
    consent: boolean
  ) {
    const capability = dependencies.resolveCapability(capabilityId);
    if (!capability) throw new Error(`Cannot execute unknown capability ${capabilityId}`);
    if (capability.manifest.status !== "active") {
      throw new Error(`Capability ${capabilityId} cannot be executed from ${capability.manifest.status}`);
    }
    const adapterId = executionAdapterIdSchema.parse(requestedAdapter);
    if (adapterId === "live_codex" && !consent) throw new Error("Live Codex execution requires explicit consent.");
    const adapter = adapters.get(adapterId);
    if (!adapter) throw new Error(`Execution adapter ${adapterId} is not registered.`);
    const boundary = promptBoundary(capability);
    const request = {
      capability,
      inputSummary,
      promptBoundary: boundary,
      consent: adapterId === "live_codex" ? ("explicit" as const) : ("not_required" as const)
    };
    const attempts: ExecutionAttemptResult[] = [await adapter.execute(request)];
    if (attempts[0].status === "failed" && adapterId === "live_codex") {
      attempts.push(await preparedAdapter.execute({ ...request, consent: "not_required" }));
    }
    const finalAttempt = attempts.at(-1);
    if (finalAttempt?.status !== "succeeded" || !finalAttempt.outputSummary) {
      throw new Error(finalAttempt?.error?.message ?? "Capability execution did not produce a result.");
    }
    const fallbackUsed = attempts.length > 1;
    const recordedBoundary = attempts[0].promptBoundary ?? boundary;
    const payload = practicalApplicationPayloadSchema.parse({
      capabilityId,
      capabilityVersion: capability.manifest.version,
      inputSummary,
      outputSummary: finalAttempt.outputSummary,
      outcome: fallbackUsed ? "partial" : "successful",
      theoryElementIds: capability.manifest.theoryElementIds,
      execution: {
        requestedAdapter: adapterId,
        completedAdapter: finalAttempt.adapter,
        consent: request.consent,
        fallbackUsed,
        promptBoundary: recordedBoundary,
        inputProvenance: {
          origin: "user_supplied",
          sourceIds: capability.manifest.sourceIds,
          theoryElementIds: capability.manifest.theoryElementIds
        },
        attempts: attempts.map(canonicalAttempt)
      }
    });
    const event: EvidenceEvent = {
      id: createId("evt-practical-application"),
      type: "practical.application_recorded",
      kind: "practical_observation",
      createdAt: now(),
      actor: "agent",
      summary: fallbackUsed
        ? `Live execution failed recoverably; ${capability.manifest.name} completed with the prepared adapter.`
        : `Executed ${capability.manifest.name} with the ${adapterId === "prepared" ? "prepared" : "live Codex"} adapter.`,
      sourceIds: capability.manifest.sourceIds,
      payload
    };
    await dependencies.append(event);
    return event.id;
  }

  return { availability, executeCapability };
}

export type ExecutionWorkflow = ReturnType<typeof createExecutionWorkflow>;
