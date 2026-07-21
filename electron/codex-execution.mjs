import { spawn } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import {
  EXECUTION_LIMITS,
  executionPromptBoundarySchema,
  liveExecutionAvailabilitySchema,
  liveExecutionRequestSchema,
  liveExecutionResponseSchema
} from "../shared/execution-contract.js";

const LIVE_TIMEOUT_MS = 60000;
const AVAILABILITY_TIMEOUT_MS = 3000;

function safeMessage(code) {
  if (code === "capability_unavailable") {
    return "The approved capability artifact is unavailable or does not match the requested capability identity.";
  }
  if (code === "codex_unavailable") return "Codex CLI is not installed or is not available to Learning Foundry.";
  if (code === "codex_not_configured") return "Codex is available but is not authenticated or configured for live use.";
  if (code === "codex_timeout") return "Live Codex execution exceeded the one-minute limit.";
  return "Live Codex execution failed. The prepared adapter remains available.";
}

function buildPrompt(request, promptBoundary) {
  const context = promptBoundary.contextSections.map((section) => `${section.label}:\n${section.content}`).join("\n\n");
  return [
    "You are executing one bounded Learning Foundry capability.",
    "Do not use tools, inspect files, modify files, or start another session.",
    "Return only a concise practical result. State material assumptions or boundaries in the result.",
    "",
    promptBoundary.instruction,
    "",
    context,
    "",
    `Task input:\n${request.inputSummary}`
  ].join("\n");
}

export async function loadCapabilityPromptBoundary(request, capabilityRoot) {
  const expectedSkillPath = `skills/${request.capabilityId}`;
  if (request.skillPath !== expectedSkillPath) throw new Error("Capability identity does not match its skill path");
  const skillFile = resolve(capabilityRoot, expectedSkillPath, "SKILL.md");
  const file = await stat(skillFile);
  if (!file.isFile() || file.size > EXECUTION_LIMITS.contextCharacters) {
    throw new Error("Capability artifact exceeds the trusted prompt boundary");
  }
  const skill = await readFile(skillFile, "utf8");
  return {
    instruction: `Apply capability ${request.capabilityId} version ${request.capabilityVersion} to the supplied task.`,
    contextSections: [{ label: "Trusted capability artifact", content: skill }],
    excludedContext: ["API credentials", "private desktop activity", "unapproved sources", "canonical ledger contents"]
  };
}

export function runBoundedProcess(command, args, options = {}) {
  const timeoutMs = options.timeoutMs ?? LIVE_TIMEOUT_MS;
  const maximumBytes = options.maximumBytes ?? EXECUTION_LIMITS.outputCharacters;
  const now = options.now ?? (() => new Date());

  return new Promise((resolve) => {
    const started = now();
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    });
    let stdout = "";
    let stderr = "";
    let outputBytes = 0;
    let settled = false;
    let termination = "";
    let forceKillTimer;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(forceKillTimer);
      const completed = now();
      resolve({
        ...result,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        startedAt: started.toISOString(),
        completedAt: completed.toISOString(),
        durationMs: Math.max(0, completed.getTime() - started.getTime())
      });
    };

    const collect = (target) => (chunk) => {
      outputBytes += chunk.length;
      if (outputBytes > maximumBytes) {
        termination = "output_limit";
        child.kill("SIGTERM");
        return;
      }
      if (target === "stdout") stdout += chunk.toString("utf8");
      else stderr += chunk.toString("utf8");
    };
    child.stdout.on("data", collect("stdout"));
    child.stderr.on("data", collect("stderr"));
    child.on("error", (error) => finish({ ok: false, reason: error.code === "ENOENT" ? "unavailable" : "failed" }));
    child.on("close", (exitCode) => {
      if (termination === "timeout") finish({ ok: false, reason: "timeout" });
      else if (termination === "output_limit") finish({ ok: false, reason: "output_limit" });
      else finish({ ok: exitCode === 0, reason: exitCode === 0 ? undefined : "failed" });
    });
    const timer = setTimeout(() => {
      termination = "timeout";
      child.kill("SIGTERM");
      forceKillTimer = setTimeout(() => child.kill("SIGKILL"), 1000);
    }, timeoutMs);
  });
}

function errorCode(result) {
  if (result.reason === "unavailable") return "codex_unavailable";
  if (result.reason === "timeout") return "codex_timeout";
  if (/auth|api[ -]?key|log ?in|unauthorized|credential/i.test(result.stderr)) return "codex_not_configured";
  return "codex_failed";
}

export function createCodexExecutionService(options = {}) {
  const command = options.command ?? process.env.CODEX_CLI_PATH ?? "codex";
  const runProcess = options.runProcess ?? runBoundedProcess;
  const cwd = options.cwd;
  const capabilityRoot = options.capabilityRoot ?? process.cwd();
  const loadCapability = options.loadCapability ?? loadCapabilityPromptBoundary;
  const now = options.now ?? (() => new Date());

  async function availability() {
    const result = await runProcess(command, ["--version"], {
      cwd,
      timeoutMs: AVAILABILITY_TIMEOUT_MS,
      maximumBytes: 1024
    });
    if (!result.ok) {
      const code = result.reason === "unavailable" ? "codex_unavailable" : "codex_not_configured";
      return liveExecutionAvailabilitySchema.parse({ available: false, code, message: safeMessage(code) });
    }
    return liveExecutionAvailabilitySchema.parse({
      available: true,
      adapterVersion: result.stdout || "Codex CLI"
    });
  }

  async function execute(rawRequest) {
    const request = liveExecutionRequestSchema.parse(rawRequest);
    const requestStartedAt = now();
    let promptBoundary;
    try {
      promptBoundary = executionPromptBoundarySchema.parse(await loadCapability(request, capabilityRoot));
    } catch {
      const completedAt = now();
      const code = "capability_unavailable";
      return liveExecutionResponseSchema.parse({
        ok: false,
        error: { code, message: safeMessage(code), recoverable: true },
        timing: {
          startedAt: requestStartedAt.toISOString(),
          completedAt: completedAt.toISOString(),
          durationMs: Math.max(0, completedAt.getTime() - requestStartedAt.getTime()),
          adapterVersion: "Codex CLI"
        }
      });
    }
    const result = await runProcess(
      command,
      ["-q", "-a", "suggest", "--no-project-doc", "--disable-response-storage", buildPrompt(request, promptBoundary)],
      { cwd, timeoutMs: LIVE_TIMEOUT_MS, maximumBytes: EXECUTION_LIMITS.outputCharacters }
    );
    const timing = {
      startedAt: result.startedAt,
      completedAt: result.completedAt,
      durationMs: result.durationMs,
      adapterVersion: "Codex CLI"
    };
    if (result.ok && result.stdout.trim().length >= 3) {
      return liveExecutionResponseSchema.parse({ ok: true, outputSummary: result.stdout, promptBoundary, timing });
    }
    const code = errorCode(result);
    return liveExecutionResponseSchema.parse({
      ok: false,
      error: { code, message: safeMessage(code), recoverable: true },
      promptBoundary,
      timing
    });
  }

  return { availability, execute };
}
