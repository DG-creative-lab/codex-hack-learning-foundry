import { describe, expect, it } from "vitest";
import { preparedExplainer, seedEvents } from "../data/sample";
import type { EvidenceEvent } from "../domain/types";
import { reduceWorkspace } from "../domain/workspaceProjection";
import { createLearningWorkflow } from "./learningWorkflow";

describe("learning workflow", () => {
  it("records confusion, depth, and correction as human evidence", async () => {
    const events: EvidenceEvent[] = [];
    let sequence = 0;
    const workflow = createLearningWorkflow({
      append: async (event) => {
        events.push(event);
      },
      now: () => "2026-07-19T12:30:00.000Z",
      createId: (prefix) => `${prefix}-${++sequence}`
    });

    const projectedExplainer = reduceWorkspace(seedEvents).explainers[0];
    if (!projectedExplainer) throw new Error("Prepared explainer projection is missing");

    await workflow.recordExplainerFeedback(projectedExplainer, {
      kind: "confusion",
      sectionId: "explainer-density-mechanism"
    });
    await workflow.recordExplainerFeedback(projectedExplainer, { kind: "depth", depth: "more" });
    await workflow.recordExplainerFeedback(projectedExplainer, {
      kind: "correction",
      sectionId: "explainer-density-details",
      correction: "Error recovery should be an explicit constraint."
    });

    expect(events).toHaveLength(3);
    expect(events.every((event) => event.type === "learning.explainer_feedback_recorded")).toBe(true);
    expect(events.every((event) => event.actor === "human" && event.kind === "user_interpretation")).toBe(true);
    expect(events[2]?.payload).toMatchObject({ feedback: { kind: "correction" } });
  });

  it("rejects empty corrections before appending", async () => {
    const events: EvidenceEvent[] = [];
    const workflow = createLearningWorkflow({ append: async (event) => events.push(event) });

    await expect(
      workflow.recordExplainerFeedback(preparedExplainer, {
        kind: "correction",
        sectionId: "explainer-density-details",
        correction: " "
      })
    ).rejects.toThrow();
    expect(events).toHaveLength(0);
  });
});
