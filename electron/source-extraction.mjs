import { createHash } from "node:crypto";
import { lookup as dnsLookup } from "node:dns/promises";
import { open } from "node:fs/promises";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import { basename, extname } from "node:path";
import { load } from "cheerio";
import ipaddr from "ipaddr.js";
import {
  createWebSourceDocument,
  normalizeSourceText,
  normalizeSourceUnits,
  SOURCE_CONTENT_LIMITS,
  SOURCE_HTML_RULES
} from "../shared/source-content.js";

const requestDeadlineMs = 15_000;
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
    const content = normalizeSourceText(current.join(" "));
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
  return normalizeSourceUnits(units);
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
  return normalizeSourceUnits(units);
}

export async function extractLocalSource(path) {
  const extension = extname(path).toLowerCase();
  if (extension !== ".pdf" && !allowedTextExtensions.has(extension)) {
    throw extractionError("unsupported_file", "Use a PDF, plain-text, or Markdown file.", false);
  }
  const handle = await open(path, "r");
  let buffer;
  try {
    const file = await handle.stat();
    if (!file.isFile()) throw extractionError("invalid_source", "The selected source is not a file.", false);
    if (file.size > SOURCE_CONTENT_LIMITS.maxBytes)
      throw extractionError("source_too_large", "Source exceeds the 12 MB limit.", false);
    buffer = await handle.readFile();
    if (buffer.byteLength > SOURCE_CONTENT_LIMITS.maxBytes)
      throw extractionError("source_too_large", "Source exceeds the 12 MB limit.", false);
  } finally {
    await handle.close();
  }
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

export function isPublicAddress(address) {
  try {
    return ipaddr.parse(address.split("%", 1)[0]).range() === "unicast";
  } catch {
    return false;
  }
}

function withDeadline(operation, deadlineMs) {
  return new Promise((resolve, reject) => {
    const deadline = setTimeout(
      () => reject(extractionError("request_timeout", "The source request exceeded its deadline.")),
      deadlineMs
    );
    operation.then(
      (value) => {
        clearTimeout(deadline);
        resolve(value);
      },
      (error) => {
        clearTimeout(deadline);
        reject(error);
      }
    );
  });
}

async function resolvePublicTarget(rawUrl, lookup = dnsLookup, deadlineMs = requestDeadlineMs) {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:") throw extractionError("unsafe_url", "Online sources must use HTTPS.", false);
  if (url.username || url.password || url.port)
    throw extractionError("unsafe_url", "Credentials and custom ports are not allowed.", false);
  if (url.hostname === "localhost")
    throw extractionError("unsafe_url", "Local network sources are not allowed.", false);
  const addresses = isIP(url.hostname)
    ? [{ address: url.hostname, family: isIP(url.hostname) }]
    : await withDeadline(lookup(url.hostname, { all: true, verbatim: true }), deadlineMs);
  if (addresses.length === 0 || addresses.some(({ address }) => !isPublicAddress(address))) {
    throw extractionError("unsafe_url", "Only public network sources are allowed.", false);
  }
  return { url, target: addresses[0] };
}

function pinnedLookup(target) {
  return (_hostname, options, callback) => {
    if (options?.all) callback(null, [target]);
    else callback(null, target.address, target.family);
  };
}

function requestPinnedHtml(url, target, requestImpl, deadlineMs) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let deadline;
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      if (deadline) clearTimeout(deadline);
      if (error) reject(error);
      else resolve(result);
    };
    const request = requestImpl(
      url,
      {
        method: "GET",
        agent: false,
        servername: url.hostname,
        lookup: pinnedLookup(target),
        headers: { accept: "text/html,application/xhtml+xml", "user-agent": "LearningFoundry/0.1 source extractor" }
      },
      (response) => {
        const contentLength = Number(response.headers["content-length"] ?? 0);
        if (Number.isFinite(contentLength) && contentLength > SOURCE_CONTENT_LIMITS.maxBytes) {
          response.destroy();
          finish(extractionError("source_too_large", "Source exceeds the 12 MB limit.", false));
          return;
        }
        const chunks = [];
        let bytes = 0;
        response.on("data", (chunk) => {
          bytes += chunk.length;
          if (bytes > SOURCE_CONTENT_LIMITS.maxBytes) {
            const error = extractionError("source_too_large", "Source exceeds the 12 MB limit.", false);
            response.destroy();
            request.destroy();
            finish(error);
            return;
          }
          chunks.push(chunk);
        });
        response.on("end", () =>
          finish(undefined, {
            status: response.statusCode ?? 0,
            headers: response.headers,
            html: Buffer.concat(chunks).toString("utf8")
          })
        );
        response.on("aborted", () => finish(extractionError("fetch_failed", "The source response was interrupted.")));
        response.on("error", (error) => finish(error));
      }
    );
    deadline = setTimeout(() => {
      const error = extractionError("request_timeout", "The source request exceeded its deadline.");
      request.destroy();
      finish(error);
    }, deadlineMs);
    request.on("error", (error) => finish(error));
    request.end();
  });
}

function htmlUnits(html, url) {
  const $ = load(html);
  $(SOURCE_HTML_RULES.removeSelector).remove();
  const root = $(SOURCE_HTML_RULES.rootSelector).first().length ? $(SOURCE_HTML_RULES.rootSelector).first() : $("body");
  const units = [];
  root.find(SOURCE_HTML_RULES.contentSelector).each((index, element) => {
    units.push({
      content: $(element).text(),
      location: { kind: "web", label: `Block ${index + 1}`, url: url.toString() }
    });
  });
  return units;
}

export async function extractOnlineSource(rawUrl, dependencies = {}) {
  const lookup = dependencies.lookup ?? dnsLookup;
  const requestImpl = dependencies.requestImpl ?? httpsRequest;
  const deadlineMs = dependencies.deadlineMs ?? requestDeadlineMs;
  let current = await resolvePublicTarget(rawUrl, lookup, deadlineMs);
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    const response = await requestPinnedHtml(current.url, current.target, requestImpl, deadlineMs);
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.location;
      if (typeof location !== "string" || redirects === 3)
        throw extractionError("redirect_failed", "The source redirected too many times.");
      current = await resolvePublicTarget(new URL(location, current.url).toString(), lookup, deadlineMs);
      continue;
    }
    if (response.status < 200 || response.status >= 300)
      throw extractionError("fetch_failed", `The source returned HTTP ${response.status}.`);
    const $ = load(response.html);
    const document = createWebSourceDocument({
      url: current.url.toString(),
      title: $("title").first().text(),
      author: $("meta[name='author']").attr("content") ?? "",
      fingerprint: fingerprint(Buffer.from(response.html)),
      units: htmlUnits(response.html, current.url)
    });
    if (document.units.length === 0)
      throw extractionError("empty_source", "No readable article text was found at this URL.");
    return document;
  }
  throw extractionError("fetch_failed", "Unable to fetch this source.");
}

export function serializeExtractionError(error) {
  const invalidRequest = error?.name === "ZodError";
  return {
    code: invalidRequest ? "invalid_request" : typeof error?.code === "string" ? error.code : "extraction_failed",
    message: invalidRequest
      ? "The source extraction request is invalid."
      : error instanceof Error
        ? error.message
        : String(error),
    retryable: invalidRequest ? false : typeof error?.retryable === "boolean" ? error.retryable : true
  };
}
