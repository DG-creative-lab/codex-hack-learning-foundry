import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { extractLocalSource, extractOnlineSource, serializeExtractionError } from "./source-extraction.mjs";

describe("desktop source extraction", () => {
  it("extracts paragraph units with line provenance from a local text file", async () => {
    const directory = await mkdtemp(join(tmpdir(), "foundry-source-"));
    const path = join(directory, "notes.txt");
    await writeFile(path, "Density is contextual.\nIt depends on the user.\n\nConstraints must survive.");

    const result = await extractLocalSource(path);

    expect(result.units).toHaveLength(2);
    expect(result.units[0].location).toMatchObject({ kind: "text", lineStart: 1, lineEnd: 2 });
    expect(result.fingerprint).toHaveLength(64);
  });

  it("extracts approved online HTML into the same unit shape", async () => {
    const html =
      "<html><head><title>Design Notes</title></head><body><main><p>Useful interfaces preserve meaningful context for the user.</p></main></body></html>";
    const result = await extractOnlineSource("https://example.com/article", {
      lookup: async () => [{ address: "93.184.216.34" }],
      fetchImpl: async () => new Response(html, { status: 200, headers: { "content-type": "text/html" } })
    });

    expect(result).toMatchObject({ title: "Design Notes", format: "Web page" });
    expect(result.units[0]).toMatchObject({ location: { kind: "web", url: "https://example.com/article" } });
  });

  it("rejects local network URLs with a non-retryable state", async () => {
    const error = await extractOnlineSource("https://localhost/source").catch(serializeExtractionError);
    expect(error).toMatchObject({ code: "unsafe_url", retryable: false });
  });
});
