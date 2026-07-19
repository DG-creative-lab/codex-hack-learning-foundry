import {
  type ExtractedSourceDocument,
  extractedSourceDocumentSchema,
  type SourceExtractionError
} from "../domain/sourcePipeline";

export type SourceExtractionResult =
  | { ok: true; document: ExtractedSourceDocument }
  | { ok: false; error: SourceExtractionError };

function fingerprint(text: string): Promise<string> {
  return crypto.subtle
    .digest("SHA-256", new TextEncoder().encode(text))
    .then((digest) => [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join(""));
}

async function extractOnlineInBrowser(provenance: string): Promise<SourceExtractionResult> {
  try {
    const url = new URL(provenance);
    if (url.protocol !== "https:") {
      return { ok: false, error: { code: "unsafe_url", message: "Online sources must use HTTPS.", retryable: false } };
    }
    const response = await fetch(url);
    if (!response.ok) throw new Error(`The source returned HTTP ${response.status}.`);
    const html = await response.text();
    const documentNode = new DOMParser().parseFromString(html, "text/html");
    documentNode.querySelectorAll("script, style, noscript, nav, footer, form").forEach((node) => {
      node.remove();
    });
    const root = documentNode.querySelector("article, main") ?? documentNode.body;
    const units = [...root.querySelectorAll("h1, h2, h3, p, li, blockquote")]
      .map((node, index) => ({
        content: node.textContent?.replace(/\s+/g, " ").trim() ?? "",
        location: { kind: "web" as const, label: `Block ${index + 1}`, url: url.toString() }
      }))
      .filter((unit) => unit.content.length >= 24)
      .slice(0, 120);
    if (units.length === 0) throw new Error("No readable article text was found at this URL.");
    return {
      ok: true,
      document: extractedSourceDocumentSchema.parse({
        title: documentNode.title || url.hostname,
        author: documentNode.querySelector("meta[name='author']")?.getAttribute("content") || url.hostname,
        format: "Web page",
        fingerprint: await fingerprint(html),
        units
      })
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "extraction_failed",
        message: error instanceof Error ? error.message : String(error),
        retryable: true
      }
    };
  }
}

export function extractSource(request: {
  origin: "local" | "web";
  provenance: string;
}): Promise<SourceExtractionResult> {
  if (window.foundrySources) return window.foundrySources.extract(request);
  if (request.origin === "web") return extractOnlineInBrowser(request.provenance);
  return Promise.resolve({
    ok: false,
    error: {
      code: "desktop_required",
      message: "Local files are available in the desktop app. Online extraction remains available in this preview.",
      retryable: true
    }
  });
}
