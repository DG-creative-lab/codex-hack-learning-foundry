import { z } from "zod";
import {
  capabilityManifestSchema,
  capabilityStatusSchema,
  capabilityTypeSchema
} from "../../shared/capability-contract.js";
import type { UnderstandingCheckProjection } from "./understandingChecks";

export { capabilityManifestSchema, capabilityStatusSchema, capabilityTypeSchema };

export const CAPABILITY_LIMITS = {
  idCharacters: 240,
  reasonCharacters: 1600,
  revisionCharacters: 2400,
  evidenceCharacters: 2400,
  sourceIds: 64,
  evidenceEventIds: 96,
  evaluationCases: 32,
  evaluationRuns: 96
} as const;

const boundedIdSchema = z.string().min(1).max(CAPABILITY_LIMITS.idCharacters);
const boundedIdArray = (maximum: number) => z.array(boundedIdSchema).max(maximum);
const uniqueBoundedIdArray = (maximum: number) =>
  boundedIdArray(maximum).superRefine((ids, context) => {
    if (new Set(ids).size !== ids.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Evidence event IDs must be unique." });
    }
  });

export const capabilityEvaluationResultSchema = z
  .object({
    caseId: boundedIdSchema,
    status: z.enum(["passed", "failed"]),
    evidence: z.string().trim().min(1).max(CAPABILITY_LIMITS.evidenceCharacters),
    sourceIds: boundedIdArray(CAPABILITY_LIMITS.sourceIds).min(1)
  })
  .strict();

export const capabilityEvaluationSchema = z
  .object({
    passed: z.number().int().nonnegative(),
    total: z.number().int().positive().max(CAPABILITY_LIMITS.evaluationCases),
    cases: z.array(capabilityEvaluationResultSchema).min(1).max(CAPABILITY_LIMITS.evaluationCases)
  })
  .strict()
  .superRefine((evaluation, context) => {
    if (evaluation.total !== evaluation.cases.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Evaluation total must equal the number of case results.",
        path: ["total"]
      });
    }
    if (evaluation.passed !== evaluation.cases.filter((result) => result.status === "passed").length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Evaluation passed count must equal the passed case results.",
        path: ["passed"]
      });
    }
    const caseIds = evaluation.cases.map((result) => result.caseId);
    if (new Set(caseIds).size !== caseIds.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Evaluation case result IDs must be unique.",
        path: ["cases"]
      });
    }
  });

export const capabilityRegisteredPayloadSchema = z.object({ manifest: capabilityManifestSchema }).strict();
export const capabilityEvaluationPayloadSchema = z
  .object({ capabilityId: boundedIdSchema, evaluation: capabilityEvaluationSchema })
  .strict();
export const capabilityExecutionPayloadSchema = z
  .object({ capabilityId: boundedIdSchema, inputSummary: z.string().trim().min(1).max(1200) })
  .strict();

const capabilityDecisionBaseSchema = z.object({
  capabilityId: boundedIdSchema,
  reason: z.string().trim().min(3).max(CAPABILITY_LIMITS.reasonCharacters),
  gateEvidenceEventIds: uniqueBoundedIdArray(CAPABILITY_LIMITS.evidenceEventIds)
});

export const capabilityDecisionPayloadSchema = z.discriminatedUnion("decision", [
  capabilityDecisionBaseSchema.extend({ decision: z.literal("approved") }).strict(),
  capabilityDecisionBaseSchema
    .extend({
      decision: z.literal("rejected"),
      revisionRequest: z.string().trim().min(3).max(CAPABILITY_LIMITS.revisionCharacters)
    })
    .strict()
]);

export const capabilityActivationPayloadSchema = z
  .object({
    capabilityId: boundedIdSchema,
    approvalEventId: boundedIdSchema,
    reason: z.string().trim().min(3).max(CAPABILITY_LIMITS.reasonCharacters)
  })
  .strict();

export const capabilitySupersededPayloadSchema = z
  .object({
    capabilityId: boundedIdSchema,
    replacementCapabilityId: boundedIdSchema,
    reason: z.string().trim().min(3).max(CAPABILITY_LIMITS.reasonCharacters)
  })
  .strict();

export const capabilityGateRequirementSchema = z
  .object({
    id: z.enum(["source_coverage", "operating_boundaries", "evaluation", "understanding", "human_approval"]),
    label: z.string().min(1).max(240),
    met: z.boolean(),
    rationale: z.string().min(1).max(1200),
    evidenceEventIds: uniqueBoundedIdArray(CAPABILITY_LIMITS.evidenceEventIds)
  })
  .strict();

export const capabilityGateSchema = z
  .object({
    risk: z.enum(["low", "standard", "high"]),
    approvalReady: z.boolean(),
    activationReady: z.boolean(),
    requirements: z.array(capabilityGateRequirementSchema).length(5)
  })
  .strict();

const capabilityDecisionRecordSchema = z
  .object({
    payload: capabilityDecisionPayloadSchema,
    evidenceEventId: boundedIdSchema,
    createdAt: z.string().datetime()
  })
  .strict();
const capabilityActivationRecordSchema = z
  .object({
    payload: capabilityActivationPayloadSchema,
    evidenceEventId: boundedIdSchema,
    createdAt: z.string().datetime()
  })
  .strict();
const capabilityEvaluationRecordSchema = z
  .object({
    result: capabilityEvaluationSchema,
    evidenceEventId: boundedIdSchema,
    createdAt: z.string().datetime()
  })
  .strict();

export const foundryCapabilitySchema = z
  .object({
    manifest: capabilityManifestSchema,
    registrationEventId: boundedIdSchema,
    evaluation: capabilityEvaluationRecordSchema.nullable(),
    evaluationHistory: z.array(capabilityEvaluationRecordSchema).max(CAPABILITY_LIMITS.evaluationRuns),
    decision: capabilityDecisionRecordSchema.nullable(),
    activation: capabilityActivationRecordSchema.nullable(),
    gate: capabilityGateSchema,
    executions: z.number().int().nonnegative()
  })
  .strict()
  .superRefine((capability, context) => {
    const latestEvaluation = capability.evaluationHistory.at(-1) ?? null;
    if (capability.evaluation?.evidenceEventId !== latestEvaluation?.evidenceEventId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Latest evaluation must match the final evaluation history record.",
        path: ["evaluation"]
      });
    }
    const evaluationEventIds = capability.evaluationHistory.map((record) => record.evidenceEventId);
    if (new Set(evaluationEventIds).size !== evaluationEventIds.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Evaluation history event IDs must be unique.",
        path: ["evaluationHistory"]
      });
    }
  });

export type CapabilityEvaluation = z.infer<typeof capabilityEvaluationSchema>;
export type CapabilityDecision = z.infer<typeof capabilityDecisionPayloadSchema>;
export type CapabilityActivation = z.infer<typeof capabilityActivationPayloadSchema>;
export type CapabilityGate = z.infer<typeof capabilityGateSchema>;
export type FoundryCapability = z.infer<typeof foundryCapabilitySchema>;

interface GateInput {
  capability: Pick<
    FoundryCapability,
    "manifest" | "registrationEventId" | "evaluation" | "evaluationHistory" | "decision"
  >;
  understandingChecks: UnderstandingCheckProjection[];
  eventOrder?: Map<string, number>;
  beforeEventIndex?: number;
}

function attemptExists(
  checks: UnderstandingCheckProjection[],
  kind: "prediction" | "transfer",
  theoryElementIds: Set<string>,
  eventOrder?: Map<string, number>,
  beforeEventIndex = Number.POSITIVE_INFINITY
) {
  return checks
    .filter((check) => check.kind === kind && check.theoryElementIds.some((id) => theoryElementIds.has(id)))
    .flatMap((check) => check.attempts)
    .find((attempt) => {
      const attemptIndex = eventOrder?.get(attempt.eventId) ?? -1;
      const disputeIndex = attempt.dispute ? (eventOrder?.get(attempt.dispute.evidenceEventId) ?? -1) : undefined;
      return attemptIndex < beforeEventIndex && (disputeIndex === undefined || disputeIndex >= beforeEventIndex);
    });
}

export function deriveCapabilityGate({
  capability,
  understandingChecks,
  eventOrder,
  beforeEventIndex
}: GateInput): CapabilityGate {
  const cutoff = beforeEventIndex ?? Number.POSITIVE_INFINITY;
  const theoryElementIds = new Set(capability.manifest.theoryElementIds);
  const predictionAttempt = attemptExists(understandingChecks, "prediction", theoryElementIds, eventOrder, cutoff);
  const transferAttempt = attemptExists(understandingChecks, "transfer", theoryElementIds, eventOrder, cutoff);
  const understandingPolicy = capability.manifest.activationPolicy.understanding;
  const understandingMet =
    understandingPolicy === "none" ||
    (understandingPolicy === "prediction_or_transfer" && Boolean(predictionAttempt || transferAttempt)) ||
    (understandingPolicy === "prediction_and_transfer" && Boolean(predictionAttempt && transferAttempt));
  const understandingEvidenceEventIds =
    understandingPolicy === "none"
      ? []
      : [predictionAttempt?.eventId, transferAttempt?.eventId].filter((id): id is string => Boolean(id));
  const evaluationMet = Boolean(
    capability.evaluation &&
      (!capability.manifest.activationPolicy.requirePassingEvaluation ||
        capability.evaluation.result.passed === capability.evaluation.result.total)
  );
  const approved = capability.decision?.payload.decision === "approved";
  const requirements: CapabilityGate["requirements"] = [
    {
      id: "source_coverage",
      label: "Source coverage",
      met: capability.manifest.sourceIds.length > 0,
      rationale: "The capability declares the approved sources that ground its behavior.",
      evidenceEventIds: [capability.registrationEventId]
    },
    {
      id: "operating_boundaries",
      label: "Operating boundaries",
      met: capability.manifest.operatingBoundaries.length > 0,
      rationale: "At least one inspectable boundary constrains where the capability should operate.",
      evidenceEventIds: [capability.registrationEventId]
    },
    {
      id: "evaluation",
      label: "Declared evaluations",
      met: evaluationMet,
      rationale: capability.evaluation
        ? `${capability.evaluation.result.passed} of ${capability.evaluation.result.total} declared cases passed.`
        : "No evaluation result has been recorded.",
      evidenceEventIds: capability.evaluationHistory.map((record) => record.evidenceEventId)
    },
    {
      id: "understanding",
      label: "Human participation",
      met: understandingMet,
      rationale:
        understandingPolicy === "none"
          ? "This low-risk policy does not require a prediction or transfer attempt."
          : understandingPolicy === "prediction_or_transfer"
            ? "A linked prediction or transfer attempt must be recorded."
            : "Linked prediction and transfer attempts must both be recorded.",
      evidenceEventIds: understandingEvidenceEventIds
    },
    {
      id: "human_approval",
      label: "Explicit human approval",
      met: approved,
      rationale: approved ? "A human approval decision is recorded." : "Activation always requires human approval.",
      evidenceEventIds: approved && capability.decision ? [capability.decision.evidenceEventId] : []
    }
  ];
  const approvalReady = requirements
    .filter((requirement) => requirement.id !== "human_approval")
    .every(({ met }) => met);
  return {
    risk: capability.manifest.activationPolicy.risk,
    approvalReady,
    activationReady: approvalReady && approved,
    requirements
  };
}
