import { describe, expect, it, vi } from "vitest";
import { createCodexExecutionService } from "./codex-execution.mjs";

const request = {
  consent: true,
  capabilityId: "capability-density-reviewer",
  capabilityVersion: "1.0.0",
  capabilityName: "Value density reviewer",
  inputSummary: "Review the prepared queue.",
  sourceIds: ["source-density-talk"],
  theoryElementIds: ["theory-density-purpose"],
  promptBoundary: {
    instruction: "Apply the declared capability to the supplied task.",
    contextSections: [{ label: "Operating boundaries", content: "Do not infer an audience without evidence." }],
    excludedContext: ["API credentials", "canonical ledger contents"]
  }
};

const timing = {
  startedAt: "2026-07-20T10:00:00.000Z",
  completedAt: "2026-07-20T10:00:01.000Z",
  durationMs: 1000
};

describe("Codex execution service", () => {
  it("reports a locally available CLI without making an execution request", async () => {
    const runProcess = vi.fn(async () => ({ ok: true, stdout: "codex 1.2.3", stderr: "", ...timing }));
    const service = createCodexExecutionService({ runProcess, command: "codex-test" });

    await expect(service.availability()).resolves.toEqual({ available: true, adapterVersion: "codex 1.2.3" });
    expect(runProcess).toHaveBeenCalledWith("codex-test", ["--version"], expect.any(Object));
  });

  it("runs one quiet bounded prompt and returns only the result and timing", async () => {
    const runProcess = vi.fn(async () => ({
      ok: true,
      stdout: "Preserve the visible queue context and reduce repeated metadata.",
      stderr: "",
      ...timing
    }));
    const service = createCodexExecutionService({ runProcess, command: "codex-test" });

    const result = await service.execute(request);

    expect(result).toMatchObject({ ok: true, timing: { adapterVersion: "Codex CLI" } });
    const args = runProcess.mock.calls[0][1];
    expect(args).toContain("--disable-response-storage");
    expect(args.at(-1)).toContain("Do not use tools, inspect files, modify files, or start another session.");
    expect(JSON.stringify(result)).not.toContain("API credentials");
  });

  it("maps authentication failures to a recoverable result without retaining stderr", async () => {
    const runProcess = vi.fn(async () => ({
      ok: false,
      reason: "failed",
      stdout: "",
      stderr: "Unauthorized: API key secret-value is invalid",
      ...timing
    }));
    const service = createCodexExecutionService({ runProcess, command: "codex-test" });

    const result = await service.execute(request);

    expect(result).toMatchObject({
      ok: false,
      error: { code: "codex_not_configured", recoverable: true }
    });
    expect(JSON.stringify(result)).not.toContain("secret-value");
  });

  it("rejects renderer-controlled fields outside the strict request contract", async () => {
    const service = createCodexExecutionService({ runProcess: vi.fn(), command: "codex-test" });
    await expect(service.execute({ ...request, command: "rm -rf /" })).rejects.toThrow();
  });
});
