import { describe, expect, it } from "vitest";
import { sourceExtractRequestSchema } from "./source-contract.js";

describe("source extraction IPC contract", () => {
  it("accepts only strict local and HTTPS source requests", () => {
    expect(sourceExtractRequestSchema.parse({ origin: "local", provenance: "/tmp/source.pdf" })).toEqual({
      origin: "local",
      provenance: "/tmp/source.pdf"
    });
    expect(sourceExtractRequestSchema.parse({ origin: "web", provenance: "https://example.com/source" })).toEqual({
      origin: "web",
      provenance: "https://example.com/source"
    });
    expect(sourceExtractRequestSchema.safeParse({ origin: "web", provenance: "http://example.com" }).success).toBe(
      false
    );
    expect(
      sourceExtractRequestSchema.safeParse({ origin: "web", provenance: "https://user@example.com/source" }).success
    ).toBe(false);
    expect(
      sourceExtractRequestSchema.safeParse({ origin: "web", provenance: "https://example.com:8443/source" }).success
    ).toBe(false);
    expect(sourceExtractRequestSchema.safeParse({ origin: "local", provenance: "relative.txt" }).success).toBe(false);
    expect(
      sourceExtractRequestSchema.safeParse({ origin: "web", provenance: "https://example.com", extra: true }).success
    ).toBe(false);
  });

  it("rejects unbounded renderer input", () => {
    expect(sourceExtractRequestSchema.safeParse({ origin: "local", provenance: `/${"a".repeat(4096)}` }).success).toBe(
      false
    );
  });
});
