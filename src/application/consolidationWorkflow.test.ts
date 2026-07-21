import { describe, expect, it, vi } from "vitest";
import { seedEvents } from "../data/sample";
import type { EvidenceEvent } from "../domain/types";
import { reduceWorkspace } from "../domain/workspaceProjection";
import { createConsolidationWorkflow } from "./consolidationWorkflow";

describe("consolidation workflow", () => {
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

  it("narrows a correction to one declared theory revision focus", async () => {
    const workspace = reduceWorkspace(seedEvents);
    const application: EvidenceEvent = {
      id: "evt-workflow-application-subject",
      type: "practical.application_recorded",
      kind: "practical_observation",
      createdAt: "2026-07-20T12:00:00.000Z",
      actor: "agent",
      summary: "Applied the prepared capability.",
      sourceIds: workspace.capabilities[0].manifest.sourceIds,
      payload: {
        capabilityId: workspace.capabilities[0].manifest.id,
        capabilityVersion: workspace.capabilities[0].manifest.version,
        inputSummary: "Review a prepared interface.",
        outputSummary: "Preserve meaningful grouping.",
        outcome: "successful",
        theoryElementIds: workspace.capabilities[0].manifest.theoryElementIds
      }
    };
    const append = vi.fn(async () => undefined);
    const workflow = createConsolidationWorkflow({
      append,
      resolveEvent: (id) => (id === application.id ? application : undefined),
      resolveMicroWorld: () => undefined,
      resolveProposal: () => undefined,
      theory: workspace.theory,
      capabilities: workspace.capabilities,
      checks: workspace.understandingChecks,
      microWorlds: workspace.microWorlds,
      now: () => "2026-07-20T12:01:00.000Z",
      createId: (prefix) => `${prefix}-focused-test`
    });
    const focus = "theory-concept-value-density";

    await workflow.recordFeedback(application.id, "correction", "Preserve meaningful grouping.", focus);

    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({ payload: expect.objectContaining({ theoryElementIds: [focus] }) })
    );
    await expect(
      workflow.recordFeedback(application.id, "correction", "Preserve meaningful grouping.", "theory-unknown")
    ).rejects.toThrow("outside the practical evidence context");
  });
});
