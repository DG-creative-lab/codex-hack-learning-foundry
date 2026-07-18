import { z } from "zod";

export const capabilityTypeValues = ["knowledge-module", "skill", "tool", "plugin"];
export const capabilityTypeSchema = z.enum(capabilityTypeValues);

export const capabilityStatusValues = [
  "captured",
  "synthesized",
  "drafted",
  "sandboxed",
  "evaluated",
  "approved",
  "active",
  "revised",
  "deprecated"
];
export const capabilityStatusSchema = z.enum(capabilityStatusValues);

export const capabilityManifestSchema = z
  .object({
    id: z.string().min(1),
    type: capabilityTypeSchema,
    name: z.string().min(1),
    version: z.string().min(1),
    status: capabilityStatusSchema,
    createdAt: z.string().datetime(),
    sourceIds: z.array(z.string().min(1)),
    assumptions: z.array(z.string().min(1)),
    limitations: z.array(z.string().min(1)),
    evaluationFixture: z.string().min(1).optional(),
    skillPath: z.string().min(1)
  })
  .strict();
