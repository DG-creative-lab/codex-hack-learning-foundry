import { describe, expect, it, vi } from "vitest";
import { seedEvents } from "../data/sample";
import type { EvidenceEvent } from "../domain/types";
import { reduceWorkspace } from "../domain/workspaceProjection";
import { createConsolidationWorkflow } from "./consolidationWorkflow";

describe("consolidation workflow", () => {
  it("refuses application before explicit capability activation", async () => {
    const workspace = reduceWorkspace(seedEvents);
    const eventsById = new Map(seedEvents.map((event) => [event.id, event]));
    const append = vi.fn(async () => undefined);
    const workflow = createConsolidationWorkflow({
      append,
      resolveCapability: (id) => workspace.capabilities.find((capability) => capability.manifest.id === id),
      resolveEvent: (id) => eventsById.get(id),
      resolveMicroWorld: (id) => workspace.microWorlds.find((world) => world.id === id),
      resolveProposal: (id) => workspace.consolidationProposals.find((proposal) => proposal.id === id),
      theory: workspace.theory,
      capabilities: workspace.capabilities,
      checks: workspace.understandingChecks,
      microWorlds: workspace.microWorlds
    });

    await expect(
      workflow.applyCapability(
        workspace.capabilities[0].manifest.id,
        "Review the prepared queue.",
        "A review result.",
        "successful"
      )
    ).rejects.toThrow("cannot be applied from evaluated");
    expect(append).not.toHaveBeenCalled();
  });

  it("records categorized feedback against canonical eligible evidence", async () => {
    const workspace = reduceWorkspace(seedEvents);
    const world = workspace.microWorlds[0];
    const subject: EvidenceEvent = {
      id: "evt-workflow-micro-subject",
      type: "learning.micro_world_reflection_recorded",
      kind: "user_interpretation",
      createdAt: "2026-07-20T12:00:00.000Z",
      actor: "human",
      summary: "Reflected on a recorded interaction.",
      sourceIds: world.sourceIds,
      payload: {
        artifactId: world.id,
        prompt: world.reflectionPrompts[0],
        response: "Meaning-bearing spacing changed the result.",
        interactionEventId: "evt-existing-interaction"
      }
    };
    const append = vi.fn(async () => undefined);
    const workflow = createConsolidationWorkflow({
      append,
      resolveCapability: () => undefined,
      resolveEvent: (id) => (id === subject.id ? subject : undefined),
      resolveMicroWorld: (id) => (id === world.id ? world : undefined),
      resolveProposal: () => undefined,
      theory: workspace.theory,
      capabilities: workspace.capabilities,
      checks: workspace.understandingChecks,
      microWorlds: workspace.microWorlds,
      now: () => "2026-07-20T12:01:00.000Z",
      createId: (prefix) => `${prefix}-test`
    });

    await workflow.recordFeedback(subject.id, "correction", "Preserve spacing that communicates grouping.");
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "practical.correction_recorded",
        actor: "human",
        kind: "user_interpretation",
        payload: expect.objectContaining({ subjectEventId: subject.id, theoryElementIds: world.theoryElementIds })
      })
    );
  });
});
