import { z } from "zod";

export const capabilityStatusValues = [
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

export const capabilityStatusSchema = z.enum(capabilityStatusValues);
