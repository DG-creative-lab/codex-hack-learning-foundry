import { z } from "zod";

export const EXECUTION_LIMITS = {
  idCharacters: 240,
  inputCharacters: 2400,
  outputCharacters: 2400,
  instructionCharacters: 2400,
  contextCharacters: 2400,
  contextSections: 12,
  contextLabels: 80,
  excludedItems: 12,
  errorCharacters: 600,
  theoryElementIds: 64,
  sourceIds: 64
};

const boundedId = z.string().trim().min(1).max(EXECUTION_LIMITS.idCharacters);
const uniqueIds = (maximum) =>
  z
    .array(boundedId)
    .min(1)
    .max(maximum)
    .superRefine((ids, context) => {
      if (new Set(ids).size !== ids.length) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "Execution provenance IDs must be unique." });
      }
    });

export const executionAdapterIdSchema = z.enum(["prepared", "live_codex"]);

export const executionPromptBoundarySchema = z
  .object({
    instruction: z.string().trim().min(3).max(EXECUTION_LIMITS.instructionCharacters),
    contextSections: z
      .array(
        z
          .object({
            label: z.string().trim().min(1).max(EXECUTION_LIMITS.contextLabels),
            content: z.string().trim().min(1).max(EXECUTION_LIMITS.contextCharacters)
          })
          .strict()
      )
      .min(1)
      .max(EXECUTION_LIMITS.contextSections),
    excludedContext: z
      .array(z.string().trim().min(1).max(EXECUTION_LIMITS.contextLabels))
      .min(1)
      .max(EXECUTION_LIMITS.excludedItems)
  })
  .strict();

export const liveExecutionRequestSchema = z
  .object({
    consent: z.literal(true),
    capabilityId: boundedId,
    capabilityVersion: z.string().trim().min(1).max(80),
    capabilityName: z.string().trim().min(1).max(240),
    inputSummary: z.string().trim().min(3).max(EXECUTION_LIMITS.inputCharacters),
    sourceIds: uniqueIds(EXECUTION_LIMITS.sourceIds),
    theoryElementIds: uniqueIds(EXECUTION_LIMITS.theoryElementIds),
    promptBoundary: executionPromptBoundarySchema
  })
  .strict();

const executionTimingSchema = z
  .object({
    startedAt: z.string().datetime(),
    completedAt: z.string().datetime(),
    durationMs: z.number().int().nonnegative().max(300000),
    adapterVersion: z.string().trim().min(1).max(120)
  })
  .strict();

export const liveExecutionResponseSchema = z.discriminatedUnion("ok", [
  z
    .object({
      ok: z.literal(true),
      outputSummary: z.string().trim().min(3).max(EXECUTION_LIMITS.outputCharacters),
      timing: executionTimingSchema
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      error: z
        .object({
          code: z.enum(["codex_unavailable", "codex_not_configured", "codex_timeout", "codex_failed"]),
          message: z.string().trim().min(1).max(EXECUTION_LIMITS.errorCharacters),
          recoverable: z.boolean()
        })
        .strict(),
      timing: executionTimingSchema
    })
    .strict()
]);

export const liveExecutionAvailabilitySchema = z.discriminatedUnion("available", [
  z.object({ available: z.literal(true), adapterVersion: z.string().trim().min(1).max(120) }).strict(),
  z
    .object({
      available: z.literal(false),
      code: z.enum(["codex_unavailable", "codex_not_configured"]),
      message: z.string().trim().min(1).max(EXECUTION_LIMITS.errorCharacters)
    })
    .strict()
]);
