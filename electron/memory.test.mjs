import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { appendMemoryEntry, ensureMemoryFile, loadMemoryFile, parseMemoryContents } from "./memory.mjs";

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

  it("validates entries before appending them", async () => {
    const path = await temporaryMemoryPath();
    await expect(appendMemoryEntry(path, { ...validEvent(), actor: "intruder" })).rejects.toThrow();
    await expect(stat(path)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("does not replace a path that fails for a reason other than absence", async () => {
    const path = await temporaryMemoryPath();
    await expect(ensureMemoryFile(dirname(path))).rejects.toMatchObject({ code: "EISDIR" });
  });
});
