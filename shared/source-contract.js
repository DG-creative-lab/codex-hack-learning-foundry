import { z } from "zod";

const localPathSchema = z
  .string()
  .trim()
  .min(1)
  .max(4096)
  .refine((value) => value.startsWith("/") && !value.includes("\0"), "Local provenance must be an absolute path");

const approvedUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(2048)
  .url()
  .refine((value) => {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.port;
  }, "Online provenance must use HTTPS without credentials or a custom port");

export const sourceExtractRequestSchema = z.discriminatedUnion("origin", [
  z.object({ origin: z.literal("local"), provenance: localPathSchema }).strict(),
  z.object({ origin: z.literal("web"), provenance: approvedUrlSchema }).strict()
]);
