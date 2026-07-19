import { createWebSourceDocument, SOURCE_CONTENT_LIMITS, SOURCE_HTML_RULES } from "../../shared/source-content.js";
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
    const contentLength = Number(response.headers.get("content-length") ?? 0);
    if (Number.isFinite(contentLength) && contentLength > SOURCE_CONTENT_LIMITS.maxBytes) {
      throw new Error("Source exceeds the 12 MB limit.");
    }
    const html = await response.text();
    if (new TextEncoder().encode(html).byteLength > SOURCE_CONTENT_LIMITS.maxBytes) {
      throw new Error("Source exceeds the 12 MB limit.");
    }
    const documentNode = new DOMParser().parseFromString(html, "text/html");
    documentNode.querySelectorAll(SOURCE_HTML_RULES.removeSelector).forEach((node) => {
      node.remove();
    });
    const root = documentNode.querySelector(SOURCE_HTML_RULES.rootSelector) ?? documentNode.body;
    const units = [...root.querySelectorAll(SOURCE_HTML_RULES.contentSelector)].map((node, index) => ({
      content: node.textContent ?? "",
      location: { kind: "web" as const, label: `Block ${index + 1}`, url: url.toString() }
    }));
    const extracted = createWebSourceDocument({
      url: url.toString(),
      title: documentNode.title,
      author: documentNode.querySelector("meta[name='author']")?.getAttribute("content") ?? "",
      fingerprint: await fingerprint(html),
      units
    });
    if (extracted.units.length === 0) throw new Error("No readable article text was found at this URL.");
    return {
      ok: true,
      document: extractedSourceDocumentSchema.parse(extracted)
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
