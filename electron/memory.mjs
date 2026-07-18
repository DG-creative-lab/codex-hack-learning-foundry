import { createReadStream } from "node:fs";
import { appendFile, mkdir, open, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { createInterface } from "node:readline";
import { evidenceEventSchema } from "../shared/evidence-event.js";

async function openMemoryFile(path, flags) {
  await mkdir(dirname(path), { recursive: true });
  const handle = await open(path, flags, 0o600);
  try {
    const file = await handle.stat();
    if (!file.isFile()) {
      const error = new Error(`Memory path is not a file: ${path}`);
      error.code = file.isDirectory() ? "EISDIR" : "EINVAL";
      throw error;
    }
    return handle;
  } catch (error) {
    await handle.close();
    throw error;
  }
}

export async function ensureMemoryFile(path) {
  const handle = await openMemoryFile(path, "a");
  await handle.close();
  return path;
}

function parseMemoryLine(raw, line, events, rejected) {
  if (!raw.trim()) return;
  try {
    const result = evidenceEventSchema.safeParse(JSON.parse(raw));
    if (result.success) events.push(result.data);
    else rejected.push({ line, raw, reason: result.error.message });
  } catch (error) {
    rejected.push({ line, raw, reason: error instanceof Error ? error.message : String(error) });
  }
}

export function parseMemoryContents(contents) {
  const events = [];
  const rejected = [];
  for (const [index, raw] of contents.split("\n").entries()) {
    parseMemoryLine(raw, index + 1, events, rejected);
  }
  return { events, rejected };
}

async function streamMemoryFile(handle) {
  const events = [];
  const rejected = [];
  const lines = createInterface({
    input: createReadStream("", { fd: handle.fd, autoClose: false, encoding: "utf8", start: 0 }),
    crlfDelay: Infinity
  });
  let line = 0;
  for await (const raw of lines) {
    line += 1;
    parseMemoryLine(raw, line, events, rejected);
  }
  return { events, rejected };
}

export async function loadMemoryFile(path) {
  const handle = await openMemoryFile(path, "a+");
  let result;
  try {
    result = await streamMemoryFile(handle);
  } finally {
    await handle.close();
  }

  if (result.rejected.length > 0) {
    const rejectedPath = `${path}.rejected.jsonl`;
    const rejectedLines = result.rejected
      .map((entry) =>
        JSON.stringify({
          rejectedAt: new Date().toISOString(),
          sourceLine: entry.line,
          reason: entry.reason,
          raw: entry.raw
        })
      )
      .join("\n");
    await appendFile(rejectedPath, `${rejectedLines}\n`, "utf8");

    const recoveryPath = `${path}.recovery.tmp`;
    const validContents = result.events.map((event) => JSON.stringify(event)).join("\n");
    await writeFile(recoveryPath, validContents ? `${validContents}\n` : "", "utf8");
    await rename(recoveryPath, path);
  }

  return { events: result.events, rejectedCount: result.rejected.length };
}

export async function appendMemoryEntry(path, entry) {
  const event = evidenceEventSchema.parse(entry);
  const handle = await openMemoryFile(path, "a");
  try {
    await handle.appendFile(`${JSON.stringify(event)}\n`, "utf8");
  } finally {
    await handle.close();
  }
}

export async function resetMemoryFile(path) {
  const handle = await openMemoryFile(path, "a");
  try {
    await handle.truncate(0);
  } finally {
    await handle.close();
  }
}
