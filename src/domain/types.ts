import { z } from "zod";
import { capabilityStatusSchema } from "../../shared/capability-status.js";
import { evidenceEventSchema, evidenceKindSchema } from "../../shared/evidence-event.js";

export { capabilityStatusSchema, evidenceEventSchema, evidenceKindSchema };

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

export const theoryElementPayloadSchema = z.object({
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

export const theoryElementSchema = theoryElementPayloadSchema.superRefine((element, context) => {
  if (element.epistemicKind === "source_fact" && element.sourceIds.length === 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Source facts must reference at least one source.",
      path: ["sourceIds"]
    });
  }
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

function hasDuplicates(values: string[]): boolean {
  return new Set(values).size !== values.length;
}

export const livingTheorySchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    summary: z.string(),
    revision: z.number().int().nonnegative(),
    elements: z.array(theoryElementSchema),
    relationships: z.array(theoryRelationshipSchema),
    sourceIds: z.array(z.string()),
    evidenceEventIds: z.array(z.string())
  })
  .strict()
  .superRefine((theory, context) => {
    if (hasDuplicates(theory.elements.map((element) => element.id))) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Theory element IDs must be unique.",
        path: ["elements"]
      });
    }
    if (hasDuplicates(theory.relationships.map((relationship) => relationship.id))) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Theory relationship IDs must be unique.",
        path: ["relationships"]
      });
    }
    if (hasDuplicates(theory.sourceIds)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Theory source IDs must be unique.",
        path: ["sourceIds"]
      });
    }
    if (hasDuplicates(theory.evidenceEventIds)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Theory evidence event IDs must be unique.",
        path: ["evidenceEventIds"]
      });
    }
  });

export type TheoryElementKind = z.infer<typeof theoryElementKindSchema>;
export type TheoryElementStatus = z.infer<typeof theoryElementStatusSchema>;
export type TheoryElement = z.infer<typeof theoryElementSchema>;
export type TheoryRelationshipKind = z.infer<typeof theoryRelationshipKindSchema>;
export type TheoryRelationship = z.infer<typeof theoryRelationshipSchema>;
export type LivingTheory = z.infer<typeof livingTheorySchema>;

export type StageId = "source" | "learn" | "forge" | "evaluate" | "evolve";
export type CapabilityStatus = z.infer<typeof capabilityStatusSchema>;

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
