import { appendFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { evidenceEventSchema } from "../shared/evidence-event.js";

export async function ensureMemoryFile(path) {
  await mkdir(dirname(path), { recursive: true });
  try {
    await readFile(path, "utf8");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    await writeFile(path, "", "utf8");
  }
  return path;
}

export function parseMemoryContents(contents) {
  const events = [];
  const rejected = [];

  contents.split("\n").forEach((raw, index) => {
    if (!raw.trim()) return;
    try {
      const result = evidenceEventSchema.safeParse(JSON.parse(raw));
      if (result.success) events.push(result.data);
      else rejected.push({ line: index + 1, raw, reason: result.error.message });
    } catch (error) {
      rejected.push({ line: index + 1, raw, reason: error instanceof Error ? error.message : String(error) });
    }
  });

  return { events, rejected };
}

export async function loadMemoryFile(path) {
  await ensureMemoryFile(path);
  const contents = await readFile(path, "utf8");
  const result = parseMemoryContents(contents);

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
