import { z } from "zod";
import type { MemoryEvidenceReference } from "./memoryProjectionTypes";

export const UNDERSTANDING_GAP_LIMITS = {
  idCharacters: 480,
  titleCharacters: 240,
  rationaleCharacters: 1600,
  reviewReasonCharacters: 800,
  annotationCharacters: 1200,
  evidence: 64,
  theoryElementIds: 64
} as const;

const boundedIdSchema = z.string().min(1).max(UNDERSTANDING_GAP_LIMITS.idCharacters);

export const understandingGapKindSchema = z.enum([
  "unexplained_decision",
  "stale_theory",
  "low_prediction_evidence",
  "low_transfer_evidence",
  "black_box_capability_revision",
  "unresolved_contradiction",
  "agent_only_dependency",
  "micro_world_mismatch"
]);
export const understandingGapLevelSchema = z.enum(["notice", "attention", "priority"]);
export const understandingGapStatusSchema = z.enum(["open", "confirmed", "dismissed"]);
export const understandingGapTargetSchema = z.enum(["learn", "memory", "foundry"]);
export const understandingGapReviewPayloadSchema = z
  .object({
    gapId: boundedIdSchema,
    decision: z.enum(["confirmed", "dismissed"]),
    reason: z.string().trim().max(UNDERSTANDING_GAP_LIMITS.reviewReasonCharacters).optional()
  })
  .strict();
export const understandingGapAnnotationPayloadSchema = z
  .object({
    gapId: boundedIdSchema,
    note: z.string().trim().min(3).max(UNDERSTANDING_GAP_LIMITS.annotationCharacters)
  })
  .strict();

export type UnderstandingGapKind = z.infer<typeof understandingGapKindSchema>;
export type UnderstandingGapLevel = z.infer<typeof understandingGapLevelSchema>;
export type UnderstandingGapStatus = z.infer<typeof understandingGapStatusSchema>;
export type UnderstandingGapTarget = z.infer<typeof understandingGapTargetSchema>;
export type UnderstandingGapReview = z.infer<typeof understandingGapReviewPayloadSchema>;
export type UnderstandingGapAnnotation = z.infer<typeof understandingGapAnnotationPayloadSchema>;

export interface UnderstandingGap {
  id: string;
  kind: UnderstandingGapKind;
  level: UnderstandingGapLevel;
  status: UnderstandingGapStatus;
  title: string;
  why: string;
  severityRationale: string;
  caveat: string;
  affectedTheoryElementIds: string[];
  evidence: MemoryEvidenceReference[];
  recommendedIntervention: {
    label: string;
    target: UnderstandingGapTarget;
  };
  review?: UnderstandingGapReview & { evidenceEventId: string; createdAt: string };
  annotations: Array<UnderstandingGapAnnotation & { evidenceEventId: string; createdAt: string }>;
}

export interface UnderstandingGapProjection {
  gaps: UnderstandingGap[];
  openCount: number;
  confirmedCount: number;
  dismissedCount: number;
}
