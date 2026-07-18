import { z } from "zod";

export const evidenceKindSchema: z.ZodEnum<[
  "source_fact",
  "user_interpretation",
  "agent_synthesis",
  "practical_observation",
  "hypothesis",
  "validated_behavior"
]>;

export const evidenceEventSchema: z.ZodType<{
  id: string;
  type: string;
  kind: z.infer<typeof evidenceKindSchema>;
  createdAt: string;
  actor: "human" | "agent" | "system";
  summary: string;
  sourceIds: string[];
  payload: Record<string, unknown>;
}>;
