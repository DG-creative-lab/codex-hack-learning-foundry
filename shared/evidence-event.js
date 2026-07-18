import { z } from "zod";

export const evidenceKindSchema = z.enum([
  "source_fact",
  "user_interpretation",
  "agent_synthesis",
  "practical_observation",
  "hypothesis",
  "validated_behavior"
]);

export const evidenceEventSchema = z
  .object({
    id: z.string().min(1),
    type: z.string().min(1),
    kind: evidenceKindSchema,
    createdAt: z.string().datetime(),
    actor: z.enum(["human", "agent", "system"]),
    summary: z.string().min(1),
    sourceIds: z.array(z.string().min(1)).default([]),
    payload: z.record(z.string(), z.unknown()).default({})
  })
  .strict()
  .superRefine((event, context) => {
    if (event.kind === "source_fact" && event.sourceIds.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Source facts must reference at least one source.",
        path: ["sourceIds"]
      });
    }
  });
