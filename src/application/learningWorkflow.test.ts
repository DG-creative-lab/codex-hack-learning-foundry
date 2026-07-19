import { describe, expect, it, vi } from "vitest";
import { preparedExplainer, seedEvents } from "../data/sample";
import type { EvidenceEvent } from "../domain/types";
import { generateUnderstandingChecks } from "../domain/understandingCheckGeneration";
import type { UnderstandingCheckProjection } from "../domain/understandingChecks";
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
      resolveUnderstandingCheck: () => undefined,
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
      resolveExplainer: (artifactId) => (artifactId === preparedExplainer.id ? preparedExplainer : undefined),
      resolveUnderstandingCheck: () => undefined
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
      resolveExplainer: (artifactId) => (artifactId === preparedExplainer.id ? preparedExplainer : undefined),
      resolveUnderstandingCheck: () => undefined
    });

    await expect(workflow.recordExplainerFeedback("missing", { kind: "depth", depth: "more" })).rejects.toThrow(
      "unknown explainer missing"
    );
    await expect(
      workflow.recordExplainerFeedback(preparedExplainer.id, { kind: "confusion", sectionId: "missing" })
    ).rejects.toThrow("unknown section missing");
    expect(events).toHaveLength(0);
  });

  it("records a response and provisional evaluation as one durable attempt event", async () => {
    const events: EvidenceEvent[] = [];
    const workspace = reduceWorkspace(seedEvents);
    const check = {
      ...generateUnderstandingChecks({
        theory: workspace.theory,
        activeProject: {
          name: "Learning Foundry",
          goal: "Improve a repeated design review workflow.",
          transferScenario: "An expert triages a dense operational queue."
        }
      })[2],
      status: "ready",
      attempts: []
    } satisfies UnderstandingCheckProjection;
    const evaluateUnderstandingResponse = vi.fn(() => ({
      outcome: "partial" as const,
      evaluator: "provisional_agent" as const,
      feedback: "The prediction exposes a mechanism but still needs semantic review.",
      signals: [
        {
          dimension: "prediction" as const,
          signal: "mixed" as const,
          rationale: "A causal chain is available for inspection.",
          theoryElementIds: check.theoryElementIds
        }
      ],
      reviewItems: []
    }));
    const workflow = createLearningWorkflow({
      append: async (event) => events.push(event),
      resolveExplainer: () => undefined,
      resolveUnderstandingCheck: (checkId) => (checkId === check.id ? check : undefined),
      evaluateUnderstandingResponse,
      now: () => "2026-07-19T14:00:00.000Z",
      createId: (prefix) => `${prefix}-1`
    });

    await workflow.recordUnderstandingResponse(check.id, {
      answer: "Ignoring target size would increase errors even if more queue rows fit on screen.",
      confidence: "medium",
      sourceSupport: { level: "cited", sourceIds: check.sourceIds, fragmentIds: [] }
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "learning.understanding_attempt_recorded",
      actor: "human",
      kind: "practical_observation",
      payload: { checkId: check.id, evaluation: { outcome: "partial" } }
    });
    expect(evaluateUnderstandingResponse).toHaveBeenCalledOnce();
  });

  it("records evaluation disputes and future-check preferences as human evidence", async () => {
    const events: EvidenceEvent[] = [];
    const workspace = reduceWorkspace(seedEvents);
    const generated = generateUnderstandingChecks({
      theory: workspace.theory,
      activeProject: {
        name: "Learning Foundry",
        goal: "Improve review decisions.",
        transferScenario: "An expert triages a dense queue."
      }
    })[0];
    const check: UnderstandingCheckProjection = {
      ...generated,
      status: "ready",
      attempts: [
        {
          eventId: "evt-prepared-attempt",
          createdAt: "2026-07-19T13:00:00.000Z",
          response: {
            answer: "Visual, information, meaning, time, and value are distinct lenses.",
            confidence: "medium",
            sourceSupport: { level: "none", sourceIds: [], fragmentIds: [] }
          },
          evaluation: {
            outcome: "supported",
            evaluator: "prepared",
            feedback: "The distinctions were reconstructed.",
            signals: [
              {
                dimension: "retrieval",
                signal: "supports",
                rationale: "All five lenses were distinguished.",
                theoryElementIds: generated.theoryElementIds
              }
            ],
            reviewItems: []
          }
        }
      ]
    };
    const workflow = createLearningWorkflow({
      append: async (event) => events.push(event),
      resolveExplainer: () => undefined,
      resolveUnderstandingCheck: (checkId) => (checkId === check.id ? check : undefined)
    });

    await workflow.disputeUnderstandingEvaluation(check.id, {
      attemptEventId: "evt-prepared-attempt",
      reason: "The response named terms without explaining their distinction.",
      correction: "Record retrieval as mixed until each lens is distinguished."
    });
    await workflow.recordCheckPreference(check.id, {
      preference: "different_angle",
      reason: "Use a concrete interface next time."
    });

    expect(events.map((event) => event.type)).toEqual([
      "learning.understanding_evaluation_disputed",
      "learning.understanding_check_preference_recorded"
    ]);
    expect(events.every((event) => event.actor === "human" && event.kind === "user_interpretation")).toBe(true);
  });
});
