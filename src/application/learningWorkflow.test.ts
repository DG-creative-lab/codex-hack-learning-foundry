import { describe, expect, it, vi } from "vitest";
import { preparedExplainer, seedEvents } from "../data/sample";
import type { EvidenceEvent } from "../domain/types";
import { reduceWorkspace } from "../domain/workspaceProjection";
import { createLearningWorkflow } from "./learningWorkflow";

describe("learning workflow", () => {
  it("records confusion, depth, and correction as human evidence", async () => {
    const events: EvidenceEvent[] = [];
    let sequence = 0;
    const projectedExplainer = reduceWorkspace(seedEvents).explainers[0];
    if (!projectedExplainer) throw new Error("Prepared explainer projection is missing");
    const resolveExplainer = vi.fn((artifactId: string) =>
      artifactId === projectedExplainer.id ? projectedExplainer : undefined
    );
    const workflow = createLearningWorkflow({
      append: async (event) => {
        events.push(event);
      },
      resolveExplainer,
      now: () => "2026-07-19T12:30:00.000Z",
      createId: (prefix) => `${prefix}-${++sequence}`
    });

    await workflow.recordExplainerFeedback(projectedExplainer.id, {
      kind: "confusion",
      sectionId: "explainer-density-mechanism"
    });
    await workflow.recordExplainerFeedback(projectedExplainer.id, { kind: "depth", depth: "more" });
    await workflow.recordExplainerFeedback(projectedExplainer.id, {
      kind: "correction",
      sectionId: "explainer-density-details",
      correction: "Error recovery should be an explicit constraint."
    });

    expect(events).toHaveLength(3);
    expect(events.every((event) => event.type === "learning.explainer_feedback_recorded")).toBe(true);
    expect(events.every((event) => event.actor === "human" && event.kind === "user_interpretation")).toBe(true);
    expect(events[2]?.payload).toMatchObject({ feedback: { kind: "correction" } });
    expect(resolveExplainer).toHaveBeenCalledWith(projectedExplainer.id);
  });

  it("rejects empty corrections before appending", async () => {
    const events: EvidenceEvent[] = [];
    const workflow = createLearningWorkflow({
      append: async (event) => events.push(event),
      resolveExplainer: (artifactId) => (artifactId === preparedExplainer.id ? preparedExplainer : undefined)
    });

    await expect(
      workflow.recordExplainerFeedback(preparedExplainer.id, {
        kind: "correction",
        sectionId: "explainer-density-details",
        correction: " "
      })
    ).rejects.toThrow();
    expect(events).toHaveLength(0);
  });

  it("rejects unknown artifacts and sections before appending", async () => {
    const events: EvidenceEvent[] = [];
    const workflow = createLearningWorkflow({
      append: async (event) => events.push(event),
      resolveExplainer: (artifactId) => (artifactId === preparedExplainer.id ? preparedExplainer : undefined)
    });

    await expect(workflow.recordExplainerFeedback("missing", { kind: "depth", depth: "more" })).rejects.toThrow(
      "unknown explainer missing"
    );
    await expect(
      workflow.recordExplainerFeedback(preparedExplainer.id, { kind: "confusion", sectionId: "missing" })
    ).rejects.toThrow("unknown section missing");
    expect(events).toHaveLength(0);
  });
});
