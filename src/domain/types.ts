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

export const theoryElementKindSchema = z.enum([
  "purpose",
  "concept",
  "causal_model",
  "decision",
  "assumption",
  "boundary",
  "contradiction",
  "question"
]);

export const theoryElementStatusSchema = z.enum(["active", "unresolved", "superseded"]);

export const theoryElementSchema = z.object({
  id: z.string().min(1),
  kind: theoryElementKindSchema,
  title: z.string().min(1),
  statement: z.string().min(1),
  epistemicKind: evidenceKindSchema,
  status: theoryElementStatusSchema.default("active"),
  sourceIds: z.array(z.string()).default([]),
  evidenceEventIds: z.array(z.string()).default([]),
  revisesElementId: z.string().optional()
});

export const theoryRelationshipKindSchema = z.enum([
  "depends-on",
  "decision-because",
  "changed-by",
  "predicts",
  "supports",
  "contradicts",
  "constrained-by",
  "uncertain-about"
]);

export const theoryRelationshipSchema = z.object({
  id: z.string().min(1),
  kind: theoryRelationshipKindSchema,
  fromElementId: z.string().min(1),
  toElementId: z.string().min(1),
  sourceIds: z.array(z.string()).default([]),
  evidenceEventIds: z.array(z.string()).default([])
});

export const livingTheorySchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  summary: z.string(),
  revision: z.number().int().nonnegative(),
  elementIds: z.array(z.string()),
  elements: z.array(theoryElementSchema),
  relationshipIds: z.array(z.string()),
  relationships: z.array(theoryRelationshipSchema),
  sourceIds: z.array(z.string()),
  evidenceEventIds: z.array(z.string())
});

export type TheoryElementKind = z.infer<typeof theoryElementKindSchema>;
export type TheoryElementStatus = z.infer<typeof theoryElementStatusSchema>;
export type TheoryElement = z.infer<typeof theoryElementSchema>;
export type TheoryRelationshipKind = z.infer<typeof theoryRelationshipKindSchema>;
export type TheoryRelationship = z.infer<typeof theoryRelationshipSchema>;
export type LivingTheory = z.infer<typeof livingTheorySchema>;

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
