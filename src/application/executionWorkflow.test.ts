import { describe, expect, it, vi } from "vitest";
import { seedEvents } from "../data/sample";
import { parsePracticalApplicationEvent, practicalApplicationPayloadSchema } from "../domain/practicalEvidence";
import type { EvidenceEvent } from "../domain/types";
import { reduceWorkspace } from "../domain/workspaceProjection";
import {
  createPreparedExecutionAdapter,
  type ExecutionAdapter,
  type ExecutionAttemptResult
} from "./executionAdapters";
import { createExecutionWorkflow } from "./executionWorkflow";

const fixedDate = new Date("2026-07-20T10:00:00.000Z");

function workspaceCapability(status: "evaluated" | "active") {
  const workspace = reduceWorkspace(seedEvents);
  const capability = workspace.capabilities[0];
  return { ...capability, manifest: { ...capability.manifest, status } };
}

function liveAdapter(result: ExecutionAttemptResult): ExecutionAdapter {
  return {
    id: "live_codex",
    availability: vi.fn(async () => ({ available: true as const, adapterVersion: "Codex CLI test" })),
    execute: vi.fn(async () => result)
  };
}

describe("execution workflow", () => {
  it("keeps the prepared adapter deterministic and refuses inactive capabilities", async () => {
    const capability = workspaceCapability("evaluated");
    const append = vi.fn(async () => undefined);
    const workflow = createExecutionWorkflow({
      append,
      resolveCapability: () => capability,
      adapters: [createPreparedExecutionAdapter({ now: () => fixedDate })]
    });

    await expect(
      workflow.executeCapability(capability.manifest.id, "Review the prepared queue.", "prepared", false)
    ).rejects.toThrow("cannot be executed from evaluated");
    expect(append).not.toHaveBeenCalled();
  });

  it("records prepared execution with bounded prompt and input provenance", async () => {
    const capability = workspaceCapability("active");
    const append = vi.fn(async (_event: EvidenceEvent) => undefined);
    const workflow = createExecutionWorkflow({
      append,
      resolveCapability: () => capability,
      adapters: [createPreparedExecutionAdapter({ now: () => fixedDate })],
      now: () => fixedDate.toISOString(),
      createId: (prefix) => `${prefix}-test`
    });

    await workflow.executeCapability(capability.manifest.id, "Review the prepared queue.", "prepared", false);

    const event = append.mock.calls[0][0];
    const payload = practicalApplicationPayloadSchema.parse(event.payload);
    expect(event.type).toBe("practical.application_recorded");
    expect(payload.execution).toMatchObject({
      requestedAdapter: "prepared",
      completedAdapter: "prepared",
      consent: "not_required",
      fallbackUsed: false,
      inputProvenance: {
        origin: "user_supplied",
        sourceIds: capability.manifest.sourceIds,
        theoryElementIds: capability.manifest.theoryElementIds
      }
    });
    expect(payload.execution.promptBoundary.excludedContext).toContain("API credentials");
  });

  it("requires explicit consent before invoking live Codex", async () => {
    const capability = workspaceCapability("active");
    const live = liveAdapter({
      adapter: "live_codex",
      status: "succeeded",
      startedAt: fixedDate.toISOString(),
      completedAt: fixedDate.toISOString(),
      durationMs: 0,
      adapterVersion: "test",
      outputSummary: "Live result"
    });
    const workflow = createExecutionWorkflow({
      append: vi.fn(async () => undefined),
      resolveCapability: () => capability,
      adapters: [createPreparedExecutionAdapter({ now: () => fixedDate }), live]
    });

    await expect(
      workflow.executeCapability(capability.manifest.id, "Review the prepared queue.", "live_codex", false)
    ).rejects.toThrow("explicit consent");
    expect(live.execute).not.toHaveBeenCalled();
  });

  it("records a failed live attempt and one prepared fallback atomically", async () => {
    const capability = workspaceCapability("active");
    const append = vi.fn(async (_event: EvidenceEvent) => undefined);
    const live = liveAdapter({
      adapter: "live_codex",
      status: "failed",
      startedAt: fixedDate.toISOString(),
      completedAt: fixedDate.toISOString(),
      durationMs: 0,
      adapterVersion: "Codex CLI test",
      error: { code: "codex_not_configured", message: "Codex is not configured.", recoverable: true }
    });
    const workflow = createExecutionWorkflow({
      append,
      resolveCapability: () => capability,
      adapters: [createPreparedExecutionAdapter({ now: () => fixedDate }), live],
      now: () => fixedDate.toISOString()
    });

    await workflow.executeCapability(capability.manifest.id, "Review the prepared queue.", "live_codex", true);

    expect(append).toHaveBeenCalledTimes(1);
    const payload = practicalApplicationPayloadSchema.parse(append.mock.calls[0][0].payload);
    expect(payload).toMatchObject({ outcome: "partial" });
    expect(payload.execution).toMatchObject({
      requestedAdapter: "live_codex",
      completedAdapter: "prepared",
      consent: "explicit",
      fallbackUsed: true
    });
    expect(payload.execution.attempts.map(({ adapter, status }) => ({ adapter, status }))).toEqual([
      { adapter: "live_codex", status: "failed" },
      { adapter: "prepared", status: "succeeded" }
    ]);
  });

  it("projects application events written before adapter traces were introduced", () => {
    const capability = workspaceCapability("active");
    const event: EvidenceEvent = {
      id: "evt-legacy-manual-application",
      type: "practical.application_recorded",
      kind: "practical_observation",
      createdAt: fixedDate.toISOString(),
      actor: "agent",
      summary: "Recorded a manual application result.",
      sourceIds: capability.manifest.sourceIds,
      payload: {
        capabilityId: capability.manifest.id,
        capabilityVersion: capability.manifest.version,
        inputSummary: "Review the prepared queue.",
        outputSummary: "A manually observed result.",
        outcome: "partial",
        theoryElementIds: capability.manifest.theoryElementIds
      }
    };

    expect(parsePracticalApplicationEvent(event).execution).toMatchObject({
      requestedAdapter: "prepared",
      completedAdapter: "prepared",
      fallbackUsed: false,
      attempts: [{ adapterVersion: "legacy-manual-v0" }]
    });
  });
});
