import { createReadStream } from "node:fs";
import { appendFile, mkdir, rename, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { createInterface } from "node:readline";
import { evidenceEventSchema } from "../shared/evidence-event.js";

export async function ensureMemoryFile(path) {
  await mkdir(dirname(path), { recursive: true });
  try {
    const file = await stat(path);
    if (!file.isFile()) {
      const error = new Error(`Memory path is not a file: ${path}`);
      error.code = file.isDirectory() ? "EISDIR" : "EINVAL";
      throw error;
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    await writeFile(path, "", "utf8");
  }
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
  contents.split("\n").forEach((raw, index) => parseMemoryLine(raw, index + 1, events, rejected));
  return { events, rejected };
}

async function streamMemoryFile(path) {
  const events = [];
  const rejected = [];
  const lines = createInterface({ input: createReadStream(path, { encoding: "utf8" }), crlfDelay: Infinity });
  let line = 0;
  for await (const raw of lines) {
    line += 1;
    parseMemoryLine(raw, line, events, rejected);
  }
  return { events, rejected };
}

export async function loadMemoryFile(path) {
  await ensureMemoryFile(path);
  const result = await streamMemoryFile(path);

  if (result.rejected.length > 0) {
    const rejectedPath = `${path}.rejected.jsonl`;
    const rejectedLines = result.rejected.map((entry) => JSON.stringify({
      rejectedAt: new Date().toISOString(),
      sourceLine: entry.line,
      reason: entry.reason,
      raw: entry.raw
    })).join("\n");
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
  await ensureMemoryFile(path);
  await appendFile(path, `${JSON.stringify(event)}\n`, "utf8");
}

export async function resetMemoryFile(path) {
  await ensureMemoryFile(path);
  await writeFile(path, "", "utf8");
}
