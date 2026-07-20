import type { z } from "zod";

export const EXECUTION_LIMITS: {
  readonly idCharacters: 240;
  readonly inputCharacters: 2400;
  readonly outputCharacters: 2400;
  readonly instructionCharacters: 2400;
  readonly contextCharacters: 2400;
  readonly contextSections: 12;
  readonly contextLabels: 80;
  readonly excludedItems: 12;
  readonly errorCharacters: 600;
  readonly theoryElementIds: 64;
  readonly sourceIds: 64;
};

export const executionAdapterIdSchema: z.ZodEnum<["prepared", "live_codex"]>;
export const executionPromptBoundarySchema: z.ZodType<{
  instruction: string;
  contextSections: Array<{ label: string; content: string }>;
  excludedContext: string[];
}>;
export const liveExecutionRequestSchema: z.ZodType<{
  consent: true;
  capabilityId: string;
  capabilityVersion: string;
  capabilityName: string;
  inputSummary: string;
  sourceIds: string[];
  theoryElementIds: string[];
  promptBoundary: z.infer<typeof executionPromptBoundarySchema>;
}>;
export const liveExecutionResponseSchema: z.ZodType<
  | {
      ok: true;
      outputSummary: string;
      timing: { startedAt: string; completedAt: string; durationMs: number; adapterVersion: string };
    }
  | {
      ok: false;
      error: {
        code: "codex_unavailable" | "codex_not_configured" | "codex_timeout" | "codex_failed";
        message: string;
        recoverable: boolean;
      };
      timing: { startedAt: string; completedAt: string; durationMs: number; adapterVersion: string };
    }
>;
export const liveExecutionAvailabilitySchema: z.ZodType<
  | { available: true; adapterVersion: string }
  | {
      available: false;
      code: "codex_unavailable" | "codex_not_configured";
      message: string;
    }
>;
