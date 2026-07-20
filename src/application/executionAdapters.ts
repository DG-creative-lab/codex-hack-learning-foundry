import type { z } from "zod";
import {
  EXECUTION_LIMITS,
  type executionAdapterIdSchema,
  type executionPromptBoundarySchema,
  liveExecutionAvailabilitySchema,
  liveExecutionRequestSchema,
  liveExecutionResponseSchema
} from "../../shared/execution-contract.js";
import type { FoundryCapability } from "../domain/capability";

export type ExecutionAdapterId = z.infer<typeof executionAdapterIdSchema>;
export type ExecutionAvailability = z.infer<typeof liveExecutionAvailabilitySchema>;

export interface CapabilityExecutionRequest {
  capability: FoundryCapability;
  inputSummary: string;
  promptBoundary: z.infer<typeof executionPromptBoundarySchema>;
  consent: "not_required" | "explicit";
}

export interface ExecutionAttemptResult {
  adapter: ExecutionAdapterId;
  status: "succeeded" | "failed";
  startedAt: string;
  completedAt: string;
  durationMs: number;
  adapterVersion: string;
  outputSummary?: string;
  error?: { code: string; message: string; recoverable: boolean };
}

export interface ExecutionAdapter {
  id: ExecutionAdapterId;
  availability: () => Promise<ExecutionAvailability>;
  execute: (request: CapabilityExecutionRequest) => Promise<ExecutionAttemptResult>;
}

function boundedPreparedOutput(request: CapabilityExecutionRequest) {
  const evaluationFocus = request.capability.manifest.evaluationCases
    .slice(0, 3)
    .map((item) => item.title)
    .join(", ");
  const boundary = request.capability.manifest.operatingBoundaries[0];
  const input = request.inputSummary.slice(0, 900);
  return [
    `Prepared ${request.capability.manifest.name} result for: ${input}`,
    `Evaluation focus: ${evaluationFocus}.`,
    `Operating boundary: ${boundary}`
  ]
    .join("\n")
    .slice(0, EXECUTION_LIMITS.outputCharacters);
}

export function createPreparedExecutionAdapter(options: { now?: () => Date } = {}): ExecutionAdapter {
  const now = options.now ?? (() => new Date());
  return {
    id: "prepared",
    availability: async () => ({ available: true, adapterVersion: "prepared-v1" }),
    execute: async (request) => {
      const startedAt = now();
      const completedAt = now();
      return {
        adapter: "prepared",
        status: "succeeded",
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
        durationMs: Math.max(0, completedAt.getTime() - startedAt.getTime()),
        adapterVersion: "prepared-v1",
        outputSummary: boundedPreparedOutput(request)
      };
    }
  };
}

type LiveExecutionBridge = NonNullable<Window["foundryExecution"]>;

export function createLiveCodexExecutionAdapter(
  bridge: LiveExecutionBridge | undefined = window.foundryExecution,
  options: { now?: () => Date } = {}
): ExecutionAdapter {
  const now = options.now ?? (() => new Date());
  const unavailableMessage =
    "Live Codex execution is unavailable in this environment. The prepared adapter remains ready.";
  const unavailable = (): ExecutionAvailability => ({
    available: false,
    code: "codex_unavailable",
    message: unavailableMessage
  });
  return {
    id: "live_codex",
    availability: async () => {
      if (!bridge) return unavailable();
      try {
        return liveExecutionAvailabilitySchema.parse(await bridge.liveAvailability());
      } catch {
        return unavailable();
      }
    },
    execute: async (request) => {
      if (request.consent !== "explicit") throw new Error("Live Codex execution requires explicit consent.");
      if (!bridge) {
        const timestamp = now().toISOString();
        return {
          adapter: "live_codex",
          status: "failed",
          startedAt: timestamp,
          completedAt: timestamp,
          durationMs: 0,
          adapterVersion: "unavailable",
          error: { code: "codex_unavailable", message: unavailableMessage, recoverable: true }
        };
      }
      const ipcRequest = liveExecutionRequestSchema.parse({
        consent: true,
        capabilityId: request.capability.manifest.id,
        capabilityVersion: request.capability.manifest.version,
        capabilityName: request.capability.manifest.name,
        inputSummary: request.inputSummary,
        sourceIds: request.capability.manifest.sourceIds,
        theoryElementIds: request.capability.manifest.theoryElementIds,
        promptBoundary: request.promptBoundary
      });
      try {
        const response = liveExecutionResponseSchema.parse(await bridge.runLive(ipcRequest));
        return response.ok
          ? { adapter: "live_codex", status: "succeeded", ...response.timing, outputSummary: response.outputSummary }
          : { adapter: "live_codex", status: "failed", ...response.timing, error: response.error };
      } catch {
        const timestamp = now().toISOString();
        return {
          adapter: "live_codex",
          status: "failed",
          startedAt: timestamp,
          completedAt: timestamp,
          durationMs: 0,
          adapterVersion: "Codex CLI",
          error: {
            code: "codex_failed",
            message: "Live Codex execution could not be completed. The prepared adapter remains available.",
            recoverable: true
          }
        };
      }
    }
  };
}
