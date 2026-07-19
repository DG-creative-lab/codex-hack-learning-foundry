import { z } from "zod";

export const sourceExtractRequestSchema: z.ZodType<
  { origin: "local"; provenance: string } | { origin: "web"; provenance: string }
>;
