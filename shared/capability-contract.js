import { z } from "zod";

export const capabilityTypeValues = ["knowledge-module", "skill", "tool", "plugin"];
export const capabilityTypeSchema = z.enum(capabilityTypeValues);

export const capabilityStatusValues = ["draft", "evaluated", "approved", "active", "rejected", "superseded"];
export const capabilityStatusSchema = z.enum(capabilityStatusValues);

export const capabilityRiskValues = ["low", "standard", "high"];
export const capabilityRiskSchema = z.enum(capabilityRiskValues);
export const capabilityUnderstandingRequirementValues = ["none", "prediction_or_transfer", "prediction_and_transfer"];
export const capabilityUnderstandingRequirementSchema = z.enum(capabilityUnderstandingRequirementValues);

const boundedText = z.string().trim().min(1).max(1200);
const boundedId = z.string().min(1).max(240);

export const capabilityEvaluationCaseSchema = z
  .object({
    id: boundedId,
    title: z.string().trim().min(1).max(240),
    expectation: boundedText,
    sourceIds: z.array(boundedId).min(1).max(32)
  })
  .strict();

export const capabilityActivationPolicySchema = z
  .object({
    risk: capabilityRiskSchema,
    understanding: capabilityUnderstandingRequirementSchema,
    requirePassingEvaluation: z.boolean()
  })
  .strict();

export const capabilityManifestSchema = z
  .object({
    id: boundedId,
    type: capabilityTypeSchema,
    name: z.string().min(1).max(240),
    version: z.string().min(1).max(80),
    status: capabilityStatusSchema,
    createdAt: z.string().datetime(),
    sourceIds: z.array(boundedId).min(1).max(64),
    theoryElementIds: z.array(boundedId).min(1).max(64),
    assumptions: z.array(boundedText).max(32),
    operatingBoundaries: z.array(boundedText).min(1).max(32),
    evaluationCases: z.array(capabilityEvaluationCaseSchema).min(1).max(32),
    activationPolicy: capabilityActivationPolicySchema,
    evaluationFixture: z.string().min(1).optional(),
    skillPath: z.string().min(1).max(480),
    supersedesCapabilityId: boundedId.optional()
  })
  .strict()
  .superRefine((manifest, context) => {
    const sourceIds = new Set(manifest.sourceIds);
    const caseIds = manifest.evaluationCases.map((evaluationCase) => evaluationCase.id);
    if (sourceIds.size !== manifest.sourceIds.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Capability source IDs must be unique.",
        path: ["sourceIds"]
      });
    }
    if (new Set(manifest.theoryElementIds).size !== manifest.theoryElementIds.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Capability theory element IDs must be unique.",
        path: ["theoryElementIds"]
      });
    }
    if (new Set(caseIds).size !== caseIds.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Capability evaluation case IDs must be unique.",
        path: ["evaluationCases"]
      });
    }
    for (const [index, evaluationCase] of manifest.evaluationCases.entries()) {
      const unknownSourceId = evaluationCase.sourceIds.find((sourceId) => !sourceIds.has(sourceId));
      if (unknownSourceId) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Evaluation case references undeclared source ${unknownSourceId}.`,
          path: ["evaluationCases", index, "sourceIds"]
        });
      }
    }
  });
