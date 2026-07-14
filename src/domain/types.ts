import { z } from "zod";

export const evidenceKindSchema = z.enum([
  "source_fact",
  "user_interpretation",
  "agent_synthesis",
  "practical_observation",
  "hypothesis",
  "validated_behavior"
]);

export const evidenceEventSchema = z.object({
  id: z.string(),
  type: z.string(),
  kind: evidenceKindSchema,
  createdAt: z.string(),
  actor: z.enum(["human", "agent", "system"]),
  summary: z.string(),
  sourceIds: z.array(z.string()).default([]),
  payload: z.record(z.string(), z.unknown()).default({})
});

export type EvidenceKind = z.infer<typeof evidenceKindSchema>;
export type EvidenceEvent = z.infer<typeof evidenceEventSchema>;

export type StageId = "source" | "learn" | "forge" | "evaluate" | "evolve";
export type CapabilityStatus = "drafted" | "sandboxed" | "evaluated" | "approved" | "active" | "revised";

export interface DensityPrinciple {
  id: string;
  index: string;
  title: string;
  definition: string;
  question: string;
  sourceRef: string;
}

export interface EvaluationCase {
  id: string;
  title: string;
  premise: string;
  expectation: string;
  status: "passed" | "pending";
  evidence: string;
}
