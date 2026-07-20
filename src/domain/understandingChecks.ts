import { z } from "zod";

export const UNDERSTANDING_CHECK_LIMITS = {
  idCharacters: 200,
  promptCharacters: 2400,
  purposeCharacters: 1200,
  projectContextCharacters: 2400,
  answerCharacters: 5000,
  feedbackCharacters: 2400,
  rationaleCharacters: 1600,
  correctionCharacters: 2400,
  preferenceReasonCharacters: 1200,
  sourceIds: 64,
  fragmentIds: 128,
  theoryElementIds: 64,
  criteria: 8,
  signals: 12,
  reviewItems: 8
} as const;

const boundedIdSchema = z.string().min(1).max(UNDERSTANDING_CHECK_LIMITS.idCharacters);
const boundedIdArray = (maximum: number) => z.array(boundedIdSchema).max(maximum);

export const understandingCheckKindSchema = z.enum(["recall", "explanation", "prediction", "teach_back", "transfer"]);
export const understandingDimensionSchema = z.enum([
  "retrieval",
  "explanation",
  "prediction",
  "transfer",
  "calibration",
  "source_use"
]);
export const understandingSignalSchema = z.enum(["supports", "mixed", "challenges"]);
export const responseConfidenceSchema = z.enum(["low", "medium", "high"]);
export const sourceSupportLevelSchema = z.enum(["none", "reasoned", "cited"]);

const sourceSupportSchema = z
  .object({
    level: sourceSupportLevelSchema,
    sourceIds: boundedIdArray(UNDERSTANDING_CHECK_LIMITS.sourceIds),
    fragmentIds: boundedIdArray(UNDERSTANDING_CHECK_LIMITS.fragmentIds)
  })
  .strict()
  .superRefine((support, context) => {
    if (support.level === "cited" && support.sourceIds.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Cited responses must identify at least one source.",
        path: ["sourceIds"]
      });
    }
    if (support.level !== "cited" && (support.sourceIds.length > 0 || support.fragmentIds.length > 0)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Source references require cited support.",
        path: ["level"]
      });
    }
  });

export const understandingResponseSchema = z
  .object({
    answer: z.string().trim().min(3).max(UNDERSTANDING_CHECK_LIMITS.answerCharacters),
    confidence: responseConfidenceSchema,
    sourceSupport: sourceSupportSchema
  })
  .strict();

const evaluationCriterionSchema = z
  .object({
    id: boundedIdSchema,
    dimension: understandingDimensionSchema,
    description: z.string().min(1).max(UNDERSTANDING_CHECK_LIMITS.rationaleCharacters),
    theoryElementIds: boundedIdArray(UNDERSTANDING_CHECK_LIMITS.theoryElementIds).min(1),
    sourceIds: boundedIdArray(UNDERSTANDING_CHECK_LIMITS.sourceIds),
    fragmentIds: boundedIdArray(UNDERSTANDING_CHECK_LIMITS.fragmentIds)
  })
  .strict();

export const understandingCheckSchema = z
  .object({
    id: boundedIdSchema,
    kind: understandingCheckKindSchema,
    prompt: z.string().min(1).max(UNDERSTANDING_CHECK_LIMITS.promptCharacters),
    purpose: z.string().min(1).max(UNDERSTANDING_CHECK_LIMITS.purposeCharacters),
    projectContext: z.string().min(1).max(UNDERSTANDING_CHECK_LIMITS.projectContextCharacters),
    sequence: z.number().int().positive(),
    cue: z
      .object({
        family: boundedIdSchema,
        variant: boundedIdSchema
      })
      .strict(),
    sourceIds: boundedIdArray(UNDERSTANDING_CHECK_LIMITS.sourceIds).min(1),
    fragmentIds: boundedIdArray(UNDERSTANDING_CHECK_LIMITS.fragmentIds),
    theoryElementIds: boundedIdArray(UNDERSTANDING_CHECK_LIMITS.theoryElementIds).min(1),
    evaluationGuide: z.array(evaluationCriterionSchema).min(1).max(UNDERSTANDING_CHECK_LIMITS.criteria)
  })
  .strict()
  .superRefine((check, context) => {
    const sourceIds = new Set(check.sourceIds);
    const fragmentIds = new Set(check.fragmentIds);
    const theoryElementIds = new Set(check.theoryElementIds);
    for (const [index, criterion] of check.evaluationGuide.entries()) {
      const unknownSourceId = criterion.sourceIds.find((id) => !sourceIds.has(id));
      const unknownFragmentId = criterion.fragmentIds.find((id) => !fragmentIds.has(id));
      const unknownTheoryId = criterion.theoryElementIds.find((id) => !theoryElementIds.has(id));
      if (unknownSourceId) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Evaluation criterion references undeclared source ${unknownSourceId}.`,
          path: ["evaluationGuide", index, "sourceIds"]
        });
      }
      if (unknownFragmentId) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Evaluation criterion references undeclared fragment ${unknownFragmentId}.`,
          path: ["evaluationGuide", index, "fragmentIds"]
        });
      }
      if (unknownTheoryId) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Evaluation criterion references undeclared theory element ${unknownTheoryId}.`,
          path: ["evaluationGuide", index, "theoryElementIds"]
        });
      }
    }
  });

const evaluationSignalSchema = z
  .object({
    dimension: understandingDimensionSchema,
    signal: understandingSignalSchema,
    rationale: z.string().min(1).max(UNDERSTANDING_CHECK_LIMITS.rationaleCharacters),
    theoryElementIds: boundedIdArray(UNDERSTANDING_CHECK_LIMITS.theoryElementIds).min(1)
  })
  .strict();

export const targetedReviewItemSchema = z
  .object({
    id: boundedIdSchema,
    title: z.string().min(1).max(240),
    prompt: z.string().min(1).max(UNDERSTANDING_CHECK_LIMITS.promptCharacters),
    theoryElementIds: boundedIdArray(UNDERSTANDING_CHECK_LIMITS.theoryElementIds).min(1),
    sourceIds: boundedIdArray(UNDERSTANDING_CHECK_LIMITS.sourceIds).min(1),
    fragmentIds: boundedIdArray(UNDERSTANDING_CHECK_LIMITS.fragmentIds)
  })
  .strict();

export const understandingEvaluationSchema = z
  .object({
    outcome: z.enum(["supported", "partial", "needs_review"]),
    feedback: z.string().min(1).max(UNDERSTANDING_CHECK_LIMITS.feedbackCharacters),
    evaluator: z.enum(["prepared", "provisional_agent"]),
    signals: z.array(evaluationSignalSchema).min(1).max(UNDERSTANDING_CHECK_LIMITS.signals),
    reviewItems: z.array(targetedReviewItemSchema).max(UNDERSTANDING_CHECK_LIMITS.reviewItems)
  })
  .strict()
  .superRefine((evaluation, context) => {
    if (evaluation.outcome === "needs_review" && evaluation.reviewItems.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Evaluations needing review must create at least one targeted review item.",
        path: ["reviewItems"]
      });
    }
  });

export const understandingAttemptPayloadSchema = z
  .object({
    checkId: boundedIdSchema,
    response: understandingResponseSchema,
    evaluation: understandingEvaluationSchema
  })
  .strict();

export const evaluationDisputePayloadSchema = z
  .object({
    checkId: boundedIdSchema,
    attemptEventId: boundedIdSchema,
    reason: z.string().trim().min(3).max(UNDERSTANDING_CHECK_LIMITS.correctionCharacters),
    correction: z.string().trim().min(3).max(UNDERSTANDING_CHECK_LIMITS.correctionCharacters)
  })
  .strict();

export const checkPreferencePayloadSchema = z
  .object({
    checkId: boundedIdSchema,
    preference: z.enum(["more_like_this", "different_angle", "reject"]),
    reason: z.string().trim().max(UNDERSTANDING_CHECK_LIMITS.preferenceReasonCharacters).optional()
  })
  .strict();

export const understandingCheckRegisteredPayloadSchema = z.object({ check: understandingCheckSchema }).strict();

export type UnderstandingCheckKind = z.infer<typeof understandingCheckKindSchema>;
export type UnderstandingDimension = z.infer<typeof understandingDimensionSchema>;
export type UnderstandingSignal = z.infer<typeof understandingSignalSchema>;
export type ResponseConfidence = z.infer<typeof responseConfidenceSchema>;
export type SourceSupportLevel = z.infer<typeof sourceSupportLevelSchema>;
export type UnderstandingCheck = z.infer<typeof understandingCheckSchema>;
export type UnderstandingResponse = z.infer<typeof understandingResponseSchema>;
export type UnderstandingEvaluation = z.infer<typeof understandingEvaluationSchema>;
export type EvaluationDispute = z.infer<typeof evaluationDisputePayloadSchema>;
export type CheckPreference = z.infer<typeof checkPreferencePayloadSchema>;

export interface UnderstandingAttemptRecord {
  eventId: string;
  createdAt: string;
  response: UnderstandingResponse;
  evaluation: UnderstandingEvaluation;
  dispute?: EvaluationDispute & { evidenceEventId: string; createdAt: string };
}

export interface UnderstandingCheckProjection extends UnderstandingCheck {
  status: "ready" | "rejected";
  attempts: UnderstandingAttemptRecord[];
  preferences: Array<CheckPreference & { evidenceEventId: string; createdAt: string }>;
  preference?: CheckPreference & { evidenceEventId: string; createdAt: string };
}

export interface DimensionEvidence {
  supports: number;
  mixed: number;
  challenges: number;
  lastObservedAt?: string;
  observations: DimensionObservation[];
}

export interface DimensionObservation {
  attemptEventId: string;
  signal: UnderstandingSignal;
  createdAt: string;
}

export interface UnderstandingEvidenceVector {
  theoryElementId: string;
  dimensions: Record<UnderstandingDimension, DimensionEvidence>;
}

export interface ProjectedReviewItem extends z.infer<typeof targetedReviewItemSchema> {
  checkId: string;
  evidenceEventIds: string[];
}

export interface UnderstandingChecksProjection {
  checks: UnderstandingCheckProjection[];
  evidenceVectors: UnderstandingEvidenceVector[];
  reviewItems: ProjectedReviewItem[];
}
