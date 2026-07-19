import { EventEmitter } from "node:events";
import { mkdtemp, truncate, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import {
  extractLocalSource,
  extractOnlineSource,
  isPublicAddress,
  serializeExtractionError
} from "./source-extraction.mjs";

function requestReturning({ status = 200, headers = {}, chunks = [], onOptions } = {}) {
  return (_url, options, callback) => {
    onOptions?.(options);
    const request = new EventEmitter();
    request.destroy = () => undefined;
    request.end = () => {
      queueMicrotask(() => {
        const response = Readable.from(chunks);
        response.statusCode = status;
        response.headers = headers;
        callback(response);
      });
    };
    return request;
  };
}

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
    let pinnedAddress;
    const result = await extractOnlineSource("https://example.com/article", {
      lookup: async () => [{ address: "93.184.216.34" }],
      requestImpl: requestReturning({
        chunks: [Buffer.from(html)],
        onOptions: (options) => {
          options.lookup("example.com", {}, (_error, address) => {
            pinnedAddress = address;
          });
        }
      })
    });

    expect(result).toMatchObject({ title: "Design Notes", format: "Web page" });
    expect(result.units[0]).toMatchObject({ location: { kind: "web", url: "https://example.com/article" } });
    expect(pinnedAddress).toBe("93.184.216.34");
  });

  it("rejects local network URLs with a non-retryable state", async () => {
    const error = await extractOnlineSource("https://localhost/source").catch(serializeExtractionError);
    expect(error).toMatchObject({ code: "unsafe_url", retryable: false });
  });

  it("rejects any DNS answer set containing a non-public address", async () => {
    const error = await extractOnlineSource("https://example.com/source", {
      lookup: async () => [
        { address: "93.184.216.34", family: 4 },
        { address: "10.0.0.5", family: 4 }
      ],
      requestImpl: requestReturning()
    }).catch(serializeExtractionError);

    expect(error).toMatchObject({ code: "unsafe_url", retryable: false });
  });

  it("aborts streaming responses immediately above the byte limit", async () => {
    const error = await extractOnlineSource("https://example.com/source", {
      lookup: async () => [{ address: "93.184.216.34", family: 4 }],
      requestImpl: requestReturning({ chunks: [Buffer.alloc(7 * 1024 * 1024), Buffer.alloc(6 * 1024 * 1024)] })
    }).catch(serializeExtractionError);

    expect(error).toMatchObject({ code: "source_too_large", retryable: false });
  });

  it("aborts requests that exceed the deadline", async () => {
    const stalledRequest = () => {
      const request = new EventEmitter();
      request.end = () => undefined;
      request.destroy = () => undefined;
      return request;
    };
    const error = await extractOnlineSource("https://example.com/source", {
      lookup: async () => [{ address: "93.184.216.34", family: 4 }],
      requestImpl: stalledRequest,
      deadlineMs: 5
    }).catch(serializeExtractionError);

    expect(error).toMatchObject({ code: "request_timeout", retryable: true });
  });

  it("applies the deadline to DNS resolution", async () => {
    const error = await extractOnlineSource("https://example.com/source", {
      lookup: () => new Promise(() => undefined),
      requestImpl: requestReturning(),
      deadlineMs: 5
    }).catch(serializeExtractionError);

    expect(error).toMatchObject({ code: "request_timeout", retryable: true });
  });

  it("rejects oversized local files before reading them", async () => {
    const directory = await mkdtemp(join(tmpdir(), "foundry-source-"));
    const path = join(directory, "large.txt");
    await writeFile(path, "");
    await truncate(path, 12 * 1024 * 1024 + 1);

    const error = await extractLocalSource(path).catch(serializeExtractionError);
    expect(error).toMatchObject({ code: "source_too_large", retryable: false });
  });

  it("classifies public and non-public address ranges conservatively", () => {
    expect(isPublicAddress("93.184.216.34")).toBe(true);
    expect(isPublicAddress("10.0.0.1")).toBe(false);
    expect(isPublicAddress("100.64.0.1")).toBe(false);
    expect(isPublicAddress("192.88.99.1")).toBe(false);
    expect(isPublicAddress("2001:4860:4860::8888")).toBe(true);
    expect(isPublicAddress("fc00::1")).toBe(false);
    expect(isPublicAddress("2001:db8::1")).toBe(false);
    expect(isPublicAddress("2001:0db8::1")).toBe(false);
  });
});
