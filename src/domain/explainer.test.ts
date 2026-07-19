import { describe, expect, it } from "vitest";
import { preparedExplainer, seedEvents } from "../data/sample";
import { EXPLAINER_LIMITS, explainerArtifactSchema, explainerFeedbackSchema } from "./explainer";
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

  it("requires section theory dependencies in the artifact manifest", () => {
    const omittedTheoryElementId = preparedExplainer.sections[0]?.theoryElementIds[0];
    if (!omittedTheoryElementId) throw new Error("Prepared section theory dependency is missing");

    const result = explainerArtifactSchema.safeParse({
      ...preparedExplainer,
      theoryElementIds: preparedExplainer.theoryElementIds.filter((id) => id !== omittedTheoryElementId)
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.message.includes("undeclared theory element"))).toBe(true);
    }
  });

  it("accepts content at ledger limits and rejects content beyond them", () => {
    const atLimit = {
      ...preparedExplainer,
      title: "t".repeat(EXPLAINER_LIMITS.titleCharacters),
      objective: "o".repeat(EXPLAINER_LIMITS.objectiveCharacters),
      projectContext: "p".repeat(EXPLAINER_LIMITS.projectContextCharacters),
      sections: preparedExplainer.sections.map((section) => ({
        ...section,
        title: "s".repeat(EXPLAINER_LIMITS.sectionTitleCharacters),
        content: "c".repeat(EXPLAINER_LIMITS.sectionContentCharacters)
      }))
    };

    expect(explainerArtifactSchema.safeParse(atLimit).success).toBe(true);
    expect(
      explainerArtifactSchema.safeParse({
        ...atLimit,
        objective: `${atLimit.objective}x`
      }).success
    ).toBe(false);
    expect(
      explainerArtifactSchema.safeParse({
        ...atLimit,
        sections: atLimit.sections.map((section, index) =>
          index === 0 ? { ...section, content: `${section.content}x` } : section
        )
      }).success
    ).toBe(false);
  });

  it("bounds generated collections and learner corrections", () => {
    const checksAtLimit = Array.from({ length: EXPLAINER_LIMITS.understandingChecks }, (_, index) => ({
      id: `check-${index}`,
      prompt: "p".repeat(EXPLAINER_LIMITS.understandingCheckPromptCharacters),
      sectionIds: [preparedExplainer.sections[0].id]
    }));
    const variablesAtLimit = Array.from({ length: EXPLAINER_LIMITS.microWorldVariables }, (_, index) => ({
      id: `variable-${index}`,
      label: "l".repeat(EXPLAINER_LIMITS.variableLabelCharacters),
      lowLabel: "low",
      highLabel: "high",
      initialValue: 50
    }));

    expect(
      explainerArtifactSchema.safeParse({
        ...preparedExplainer,
        understandingCheckSeeds: checksAtLimit,
        microWorldSeed: { ...preparedExplainer.microWorldSeed, variables: variablesAtLimit }
      }).success
    ).toBe(true);
    expect(
      explainerArtifactSchema.safeParse({
        ...preparedExplainer,
        understandingCheckSeeds: [...checksAtLimit, checksAtLimit[0]]
      }).success
    ).toBe(false);
    expect(
      explainerArtifactSchema.safeParse({
        ...preparedExplainer,
        microWorldSeed: {
          ...preparedExplainer.microWorldSeed,
          variables: [...variablesAtLimit, variablesAtLimit[0]]
        }
      }).success
    ).toBe(false);

    const correction = {
      kind: "correction" as const,
      sectionId: preparedExplainer.sections[0].id,
      correction: "c".repeat(EXPLAINER_LIMITS.correctionCharacters)
    };
    expect(explainerFeedbackSchema.safeParse(correction).success).toBe(true);
    expect(explainerFeedbackSchema.safeParse({ ...correction, correction: `${correction.correction}x` }).success).toBe(
      false
    );
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
