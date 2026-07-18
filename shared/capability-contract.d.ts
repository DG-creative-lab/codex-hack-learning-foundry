import { z } from "zod";

export const capabilityTypeValues: readonly ["knowledge-module", "skill", "tool", "plugin"];
export const capabilityTypeSchema: z.ZodEnum<["knowledge-module", "skill", "tool", "plugin"]>;
export type CapabilityType = (typeof capabilityTypeValues)[number];

export const capabilityStatusValues: readonly [
  "captured",
  "synthesized",
  "drafted",
  "sandboxed",
  "evaluated",
  "approved",
  "active",
  "revised",
  "deprecated"
];
export const capabilityStatusSchema: z.ZodEnum<
  ["captured", "synthesized", "drafted", "sandboxed", "evaluated", "approved", "active", "revised", "deprecated"]
>;
export type CapabilityStatus = (typeof capabilityStatusValues)[number];

export interface CapabilityManifest {
  id: string;
  type: CapabilityType;
  name: string;
  version: string;
  status: CapabilityStatus;
  createdAt: string;
  sourceIds: string[];
  assumptions: string[];
  limitations: string[];
  evaluationFixture?: string;
  skillPath: string;
}

export const capabilityManifestSchema: z.ZodType<CapabilityManifest>;
