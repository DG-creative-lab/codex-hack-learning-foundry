import { describe, expect, it, vi } from "vitest";
import { seedEvents } from "../data/sample";
import type { FoundryCapability } from "../domain/capability";
import type { EvidenceEvent } from "../domain/types";
import { reduceWorkspace } from "../domain/workspaceProjection";
import { createCapabilityWorkflow } from "./capabilityWorkflow";

function harness(initialCapability?: FoundryCapability) {
  let capability = initialCapability;
  const appended: EvidenceEvent[] = [];
  const append = vi.fn(async (event: EvidenceEvent) => {
    appended.push(event);
  });
  const workflow = createCapabilityWorkflow({
    append,
    resolveCapability: (id) => (capability?.manifest.id === id ? capability : undefined),
    now: () => "2026-07-20T08:00:00.000Z",
    createId: (prefix) => `${prefix}-test`
  });
  return { workflow, append, appended, setCapability: (next: FoundryCapability) => (capability = next) };
}

describe("capability workflow", () => {
  it("records an approval with exact gate evidence", async () => {
    const capability = reduceWorkspace(seedEvents).capabilities.find(
      (candidate) => candidate.manifest.id === "value-density-reviewer"
    );
    if (!capability) throw new Error("Prepared capability missing");
    const { workflow, appended } = harness(capability);

    await workflow.approve(capability.manifest.id, "The declared boundaries and evidence are sufficient.");

    const event = appended[0];
    if (!event) throw new Error("Approval event missing");
    expect(event).toMatchObject({
      type: "capability.activation_decided",
      actor: "human",
      kind: "user_interpretation",
      payload: { capabilityId: capability.manifest.id, decision: "approved" }
    });
    expect((event.payload.gateEvidenceEventIds as string[]).sort()).toEqual(
      [
        ...new Set(
          capability.gate.requirements
            .filter((requirement) => requirement.id !== "human_approval")
            .flatMap((requirement) => requirement.evidenceEventIds)
        )
      ].sort()
    );
  });

  it("records actionable rejection evidence even when a gate is blocked", async () => {
    const capability = reduceWorkspace(seedEvents).capabilities.find(
      (candidate) => candidate.manifest.id === "design-knowledge"
    );
    if (!capability) throw new Error("Prepared capability missing");
    const evaluated = { ...capability, manifest: { ...capability.manifest, status: "evaluated" as const } };
    const { workflow, append } = harness(evaluated);

    await workflow.reject(
      evaluated.manifest.id,
      "The evaluation coverage is incomplete.",
      "Add the declared provenance evaluation and resubmit this version."
    );

    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "capability.activation_decided",
        payload: expect.objectContaining({
          decision: "rejected",
          revisionRequest: "Add the declared provenance evaluation and resubmit this version."
        })
      })
    );
  });

  it("refuses approval while blocked and activation without canonical approval", async () => {
    const capabilities = reduceWorkspace(seedEvents).capabilities;
    const blocked = capabilities.find((candidate) => candidate.manifest.id === "design-knowledge");
    const evaluated = capabilities.find((candidate) => candidate.manifest.id === "value-density-reviewer");
    if (!blocked || !evaluated) throw new Error("Prepared capabilities missing");

    await expect(harness(blocked).workflow.approve(blocked.manifest.id, "Approve this draft.")).rejects.toThrow(
      "cannot be approved from draft"
    );
    await expect(harness(evaluated).workflow.activate(evaluated.manifest.id, "Activate now.")).rejects.toThrow(
      "without explicit approval"
    );
  });
});
