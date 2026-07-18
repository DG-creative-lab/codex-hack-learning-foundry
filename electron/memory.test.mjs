import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  appendMemoryEntry,
  ensureMemoryFile,
  loadMemoryFile,
  parseMemoryContents,
  resetMemoryFile
} from "./memory.mjs";

const temporaryDirectories = [];

async function temporaryMemoryPath() {
  const directory = await mkdtemp(join(tmpdir(), "learning-foundry-memory-"));
  temporaryDirectories.push(directory);
  return join(directory, "events.jsonl");
}

function validEvent(id = "evt-valid") {
  return {
    id,
    type: "source.processing_started",
    kind: "practical_observation",
    createdAt: "2026-07-18T12:00:00.000Z",
    actor: "system",
    summary: "Processing started.",
    sourceIds: ["source-a"],
    payload: { sourceId: "source-a", progress: 42 }
  };
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("Electron memory persistence", () => {
  it("parses valid records without losing them when another line is malformed", () => {
    const result = parseMemoryContents(`${JSON.stringify(validEvent())}\n{truncated\n`);
    expect(result.events).toEqual([validEvent()]);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0]?.line).toBe(2);
  });

  it("quarantines malformed lines and repairs the active ledger", async () => {
    const path = await temporaryMemoryPath();
    await writeFile(path, `${JSON.stringify(validEvent())}\n{truncated\n`, "utf8");

    await expect(loadMemoryFile(path)).resolves.toMatchObject({ rejectedCount: 1, events: [validEvent()] });
    expect(await readFile(path, "utf8")).toBe(`${JSON.stringify(validEvent())}\n`);
    expect(await readFile(`${path}.rejected.jsonl`, "utf8")).toContain("{truncated");
  });

  it("streams a larger ledger without changing event order", async () => {
    const path = await temporaryMemoryPath();
    const events = Array.from({ length: 2_000 }, (_, index) => validEvent(`evt-${index}`));
    await writeFile(path, `${events.map((event) => JSON.stringify(event)).join("\n")}\n`, "utf8");

    const loaded = await loadMemoryFile(path);
    expect(loaded.rejectedCount).toBe(0);
    expect(loaded.events).toHaveLength(events.length);
    expect(loaded.events[0]?.id).toBe("evt-0");
    expect(loaded.events.at(-1)?.id).toBe("evt-1999");
  });

  it("validates entries before appending them", async () => {
    const path = await temporaryMemoryPath();
    await expect(appendMemoryEntry(path, { ...validEvent(), actor: "intruder" })).rejects.toThrow();
    await expect(stat(path)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("appends and resets through the validated file handle", async () => {
    const path = await temporaryMemoryPath();
    await appendMemoryEntry(path, validEvent());
    expect(await readFile(path, "utf8")).toBe(`${JSON.stringify(validEvent())}\n`);

    await resetMemoryFile(path);
    expect(await readFile(path, "utf8")).toBe("");
  });

  it("atomically creates an absent memory file", async () => {
    const path = await temporaryMemoryPath();
    await expect(ensureMemoryFile(path)).resolves.toBe(path);
    expect(await readFile(path, "utf8")).toBe("");
  });

  it("does not truncate an existing memory file", async () => {
    const path = await temporaryMemoryPath();
    await writeFile(path, "existing event\n", "utf8");
    await ensureMemoryFile(path);
    expect(await readFile(path, "utf8")).toBe("existing event\n");
  });

  it("does not replace a path that fails for a reason other than absence", async () => {
    const path = await temporaryMemoryPath();
    await expect(ensureMemoryFile(dirname(path))).rejects.toMatchObject({ code: "EISDIR" });
  });
});
