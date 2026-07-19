import { z } from "zod";
import {
  capabilityManifestSchema,
  capabilityStatusSchema,
  capabilityTypeSchema
} from "../../shared/capability-contract.js";

export { capabilityManifestSchema, capabilityStatusSchema, capabilityTypeSchema };

export const sourceStatusSchema = z.enum(["ready", "review", "failed", "processing", "queued"]);
export const sourceOriginSchema = z.enum(["web", "local", "paper"]);
export const sourceOutputsSchema = z
  .object({
    atoms: z.number().int().nonnegative(),
    lessons: z.number().int().nonnegative(),
    capabilities: z.number().int().nonnegative()
  })
  .strict();

export const sourceRecordSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    author: z.string().min(1),
    origin: sourceOriginSchema,
    format: z.string().min(1),
    status: sourceStatusSchema,
    progress: z.number().min(0).max(100),
    addedAt: z.string().min(1),
    provenance: z.string().min(1),
    currentVersionId: z.string().min(1).optional(),
    previousVersionId: z.string().min(1).optional(),
    error: z
      .object({
        code: z.string().min(1),
        message: z.string().min(1),
        retryable: z.boolean()
      })
      .strict()
      .optional(),
    outputs: sourceOutputsSchema
  })
  .strict();

export const learningArtifactSchema = z
  .object({
    id: z.string().min(1),
    type: z.enum(["lesson", "exercise", "review", "reflection"]),
    title: z.string().min(1),
    state: z.enum(["in-progress", "ready", "due"]),
    statusLabel: z.string().min(1),
    evidence: z.string().min(1),
    sourceIds: z.array(z.string().min(1)),
    progress: z.number().min(0).max(100)
  })
  .strict();

export const capabilityEvaluationSchema = z
  .object({
    passed: z.number().int().nonnegative(),
    total: z.number().int().positive()
  })
  .strict()
  .refine(({ passed, total }) => passed <= total, { message: "Passed evaluations cannot exceed the total" });

export const capabilityRegisteredPayloadSchema = z.object({ manifest: capabilityManifestSchema }).strict();
export const capabilityEvaluationPayloadSchema = z
  .object({ capabilityId: z.string().min(1), evaluation: capabilityEvaluationSchema })
  .strict();
export const capabilityExecutionPayloadSchema = z.object({ capabilityId: z.string().min(1) }).strict();

export const foundryCapabilitySchema = z
  .object({
    manifest: capabilityManifestSchema,
    evaluation: capabilityEvaluationSchema.nullable(),
    executions: z.number().int().nonnegative()
  })
  .strict();

export type SourceStatus = z.infer<typeof sourceStatusSchema>;
export type SourceOrigin = z.infer<typeof sourceOriginSchema>;
export type SourceRecord = z.infer<typeof sourceRecordSchema>;
export type LearningArtifact = z.infer<typeof learningArtifactSchema>;
export type CapabilityEvaluation = z.infer<typeof capabilityEvaluationSchema>;
export type FoundryCapability = z.infer<typeof foundryCapabilitySchema>;
