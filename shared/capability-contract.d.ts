import { z } from "zod";

export const capabilityTypeValues: readonly ["knowledge-module", "skill", "tool", "plugin"];
export const capabilityTypeSchema: z.ZodEnum<["knowledge-module", "skill", "tool", "plugin"]>;
export type CapabilityType = (typeof capabilityTypeValues)[number];

export const capabilityStatusValues: readonly ["draft", "evaluated", "approved", "active", "rejected", "superseded"];
export const capabilityStatusSchema: z.ZodEnum<["draft", "evaluated", "approved", "active", "rejected", "superseded"]>;
export type CapabilityStatus = (typeof capabilityStatusValues)[number];

export const capabilityRiskValues: readonly ["low", "standard", "high"];
export const capabilityRiskSchema: z.ZodEnum<["low", "standard", "high"]>;
export type CapabilityRisk = (typeof capabilityRiskValues)[number];

export const capabilityUnderstandingRequirementValues: readonly [
  "none",
  "prediction_or_transfer",
  "prediction_and_transfer"
];
export const capabilityUnderstandingRequirementSchema: z.ZodEnum<
  ["none", "prediction_or_transfer", "prediction_and_transfer"]
>;
export type CapabilityUnderstandingRequirement = (typeof capabilityUnderstandingRequirementValues)[number];

export interface CapabilityEvaluationCase {
  id: string;
  title: string;
  expectation: string;
  sourceIds: string[];
}

export interface CapabilityActivationPolicy {
  risk: CapabilityRisk;
  understanding: CapabilityUnderstandingRequirement;
  requirePassingEvaluation: boolean;
}

export const capabilityEvaluationCaseSchema: z.ZodType<CapabilityEvaluationCase>;
export const capabilityActivationPolicySchema: z.ZodType<CapabilityActivationPolicy>;

export interface CapabilityManifest {
  id: string;
  type: CapabilityType;
  name: string;
  version: string;
  status: CapabilityStatus;
  createdAt: string;
  sourceIds: string[];
  theoryElementIds: string[];
  assumptions: string[];
  operatingBoundaries: string[];
  evaluationCases: CapabilityEvaluationCase[];
  activationPolicy: CapabilityActivationPolicy;
  evaluationFixture?: string;
  skillPath: string;
  supersedesCapabilityId?: string;
}

export const capabilityManifestSchema: z.ZodType<CapabilityManifest>;
