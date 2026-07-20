import { z } from "zod";
import {
  capabilityManifestSchema,
  capabilityStatusSchema,
  capabilityTypeSchema
} from "../../shared/capability-contract.js";

export {
  CAPABILITY_LIMITS,
  type CapabilityActivation,
  type CapabilityDecision,
  type CapabilityEvaluation,
  type CapabilityGate,
  capabilityActivationPayloadSchema,
  capabilityDecisionPayloadSchema,
  capabilityEvaluationPayloadSchema,
  capabilityEvaluationSchema,
  capabilityExecutionPayloadSchema,
  capabilityGateSchema,
  capabilityRegisteredPayloadSchema,
  capabilitySupersededPayloadSchema,
  deriveCapabilityGate,
  type FoundryCapability,
  foundryCapabilitySchema
} from "./capability";

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

export type SourceStatus = z.infer<typeof sourceStatusSchema>;
export type SourceOrigin = z.infer<typeof sourceOriginSchema>;
export type SourceRecord = z.infer<typeof sourceRecordSchema>;
export type LearningArtifact = z.infer<typeof learningArtifactSchema>;
