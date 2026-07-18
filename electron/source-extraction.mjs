import { createHash } from "node:crypto";
import { lookup as dnsLookup } from "node:dns/promises";
import { readFile } from "node:fs/promises";
import { isIP } from "node:net";
import { basename, extname } from "node:path";
import { load } from "cheerio";

const maxSourceBytes = 12 * 1024 * 1024;
const allowedTextExtensions = new Set([".txt", ".md", ".markdown"]);

function extractionError(code, message, retryable = true) {
  const error = new Error(message);
  error.code = code;
  error.retryable = retryable;
  return error;
}

function fingerprint(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function textUnits(text) {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const units = [];
  let start = 0;
  let current = [];
  function flush(end) {
    const content = current.join(" ").replace(/\s+/g, " ").trim();
    if (content) {
      units.push({
        content,
        location: { kind: "text", label: `Lines ${start + 1}-${end + 1}`, lineStart: start + 1, lineEnd: end + 1 }
      });
    }
    current = [];
  }
  lines.forEach((line, index) => {
    if (line.trim()) {
      if (current.length === 0) start = index;
      current.push(line.trim());
    } else if (current.length > 0) flush(index - 1);
  });
  if (current.length > 0) flush(lines.length - 1);
  return units;
}

async function pdfUnits(buffer) {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const document = await getDocument({ data: new Uint8Array(buffer), disableWorker: true }).promise;
  const units = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const text = await page.getTextContent();
    const content = text.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (content) units.push({ content, location: { kind: "pdf", label: `Page ${pageNumber}`, page: pageNumber } });
  }
  return units;
}

export async function extractLocalSource(path) {
  const extension = extname(path).toLowerCase();
  if (extension !== ".pdf" && !allowedTextExtensions.has(extension)) {
    throw extractionError("unsupported_file", "Use a PDF, plain-text, or Markdown file.", false);
  }
  const buffer = await readFile(path);
  if (buffer.byteLength > maxSourceBytes)
    throw extractionError("source_too_large", "Source exceeds the 12 MB limit.", false);
  const units = extension === ".pdf" ? await pdfUnits(buffer) : textUnits(buffer.toString("utf8"));
  if (units.length === 0) throw extractionError("empty_source", "No readable text was found in this source.");
  return {
    title: basename(path, extension),
    author: "Local source",
    format: extension === ".pdf" ? "PDF" : "Text",
    fingerprint: fingerprint(buffer),
    units
  };
}

function isPrivateAddress(address) {
  if (address === "::1" || address.startsWith("fc") || address.startsWith("fd") || address.startsWith("fe80:"))
    return true;
  if (address.startsWith("::ffff:")) return isPrivateAddress(address.slice(7));
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some(Number.isNaN)) return false;
  return (
    parts[0] === 10 ||
    parts[0] === 127 ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && (parts[1] ?? 0) >= 16 && (parts[1] ?? 0) <= 31) ||
    (parts[0] === 192 && parts[1] === 168) ||
    parts[0] === 0
  );
}

async function assertPublicUrl(rawUrl, lookup = dnsLookup) {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:") throw extractionError("unsafe_url", "Online sources must use HTTPS.", false);
  if (url.username || url.password || url.port)
    throw extractionError("unsafe_url", "Credentials and custom ports are not allowed.", false);
  if (url.hostname === "localhost")
    throw extractionError("unsafe_url", "Local network sources are not allowed.", false);
  const addresses = isIP(url.hostname) ? [{ address: url.hostname }] : await lookup(url.hostname, { all: true });
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw extractionError("unsafe_url", "Private network sources are not allowed.", false);
  }
  return url;
}

function htmlUnits(html, url) {
  const $ = load(html);
  $("script, style, noscript, nav, footer, form").remove();
  const root = $("article").first().length
    ? $("article").first()
    : $("main").first().length
      ? $("main").first()
      : $("body");
  const units = [];
  root.find("h1, h2, h3, p, li, blockquote").each((index, element) => {
    const content = $(element).text().replace(/\s+/g, " ").trim();
    if (content.length >= 24) {
      units.push({ content, location: { kind: "web", label: `Block ${index + 1}`, url: url.toString() } });
    }
  });
  return units.slice(0, 120);
}

export async function extractOnlineSource(rawUrl, dependencies = {}) {
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const lookup = dependencies.lookup ?? dnsLookup;
  let url = await assertPublicUrl(rawUrl, lookup);
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    const response = await fetchImpl(url, {
      redirect: "manual",
      headers: { "user-agent": "LearningFoundry/0.1 source extractor" }
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location || redirects === 3)
        throw extractionError("redirect_failed", "The source redirected too many times.");
      url = await assertPublicUrl(new URL(location, url).toString(), lookup);
      continue;
    }
    if (!response.ok) throw extractionError("fetch_failed", `The source returned HTTP ${response.status}.`);
    const contentLength = Number(response.headers.get("content-length") ?? 0);
    if (contentLength > maxSourceBytes)
      throw extractionError("source_too_large", "Source exceeds the 12 MB limit.", false);
    const html = await response.text();
    if (Buffer.byteLength(html) > maxSourceBytes)
      throw extractionError("source_too_large", "Source exceeds the 12 MB limit.", false);
    const units = htmlUnits(html, url);
    if (units.length === 0) throw extractionError("empty_source", "No readable article text was found at this URL.");
    const $ = load(html);
    return {
      title: $("title").first().text().trim() || url.hostname,
      author: $("meta[name='author']").attr("content")?.trim() || url.hostname,
      format: "Web page",
      fingerprint: fingerprint(Buffer.from(html)),
      units
    };
  }
  throw extractionError("fetch_failed", "Unable to fetch this source.");
}

export function serializeExtractionError(error) {
  return {
    code: typeof error?.code === "string" ? error.code : "extraction_failed",
    message: error instanceof Error ? error.message : String(error),
    retryable: typeof error?.retryable === "boolean" ? error.retryable : true
  };
}
