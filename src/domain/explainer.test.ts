import { describe, expect, it } from "vitest";
import { preparedExplainer, seedEvents } from "../data/sample";
import { explainerArtifactSchema } from "./explainer";
import type { EvidenceEvent } from "./types";
import { reduceWorkspace } from "./workspaceProjection";

describe("explainer artifacts", () => {
  it("projects the prepared explainer in narrative order with grounded factual sections", () => {
    const [explainer] = reduceWorkspace(seedEvents).explainers;

    expect(explainer?.sections.map((section) => section.kind)).toEqual([
      "background",
      "purpose",
      "intuition",
      "mechanism",
      "details",
      "assumptions"
    ]);
    expect(
      explainer?.sections
        .filter((section) => section.epistemicKind === "source_fact")
        .every((section) => section.fragmentIds.length > 0)
    ).toBe(true);
    expect(explainer?.understandingCheckSeeds).not.toHaveLength(0);
    expect(explainer?.microWorldSeed.variables).not.toHaveLength(0);

    const explainerEventIndex = seedEvents.findIndex((event) => event.type === "learning.explainer_registered");
    const transferEventIndex = seedEvents.findIndex((event) => {
      const artifact = event.payload.artifact as { type?: string } | undefined;
      return event.type === "learning.artifact_registered" && artifact?.type === "exercise";
    });
    expect(explainerEventIndex).toBeGreaterThanOrEqual(0);
    expect(explainerEventIndex).toBeLessThan(transferEventIndex);
  });

  it("rejects a factual section without fragment provenance", () => {
    const sections = preparedExplainer.sections.map((section) =>
      section.kind === "intuition" ? { ...section, fragmentIds: [] } : section
    );
    expect(explainerArtifactSchema.safeParse({ ...preparedExplainer, sections }).success).toBe(false);
  });

  it("rejects source order disguised as a learning narrative", () => {
    const sections = [...preparedExplainer.sections];
    sections.reverse();
    expect(explainerArtifactSchema.safeParse({ ...preparedExplainer, sections }).success).toBe(false);
  });

  it("appends corrections as evidence without mutating the original explainer", () => {
    const correction: EvidenceEvent = {
      id: "evt-learning-feedback-correction",
      type: "learning.explainer_feedback_recorded",
      kind: "user_interpretation",
      createdAt: "2026-07-19T12:00:00.000Z",
      actor: "human",
      summary: "Corrected an interpretation in the density explainer.",
      sourceIds: preparedExplainer.sourceIds,
      payload: {
        artifactId: preparedExplainer.id,
        feedback: {
          kind: "correction",
          sectionId: "explainer-density-purpose",
          correction: "The named workflow matters as much as the named user."
        }
      }
    };

    const before = reduceWorkspace(seedEvents).explainers[0];
    const after = reduceWorkspace([...seedEvents, correction]).explainers[0];

    expect(after?.sections).toEqual(before?.sections);
    expect(after?.feedback).toEqual([expect.objectContaining({ kind: "correction", evidenceEventId: correction.id })]);
  });

  it("rejects feedback for an unknown section", () => {
    const invalidFeedback: EvidenceEvent = {
      id: "evt-learning-feedback-invalid",
      type: "learning.explainer_feedback_recorded",
      kind: "user_interpretation",
      createdAt: "2026-07-19T12:00:00.000Z",
      actor: "human",
      summary: "Invalid section feedback.",
      sourceIds: preparedExplainer.sourceIds,
      payload: { artifactId: preparedExplainer.id, feedback: { kind: "confusion", sectionId: "missing" } }
    };

    expect(() => reduceWorkspace([...seedEvents, invalidFeedback])).toThrow("unknown section missing");
  });
});
