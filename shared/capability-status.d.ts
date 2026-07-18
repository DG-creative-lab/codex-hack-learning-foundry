import { z } from "zod";

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

export const capabilityStatusSchema: z.ZodEnum<[
  "captured",
  "synthesized",
  "drafted",
  "sandboxed",
  "evaluated",
  "approved",
  "active",
  "revised",
  "deprecated"
]>;
