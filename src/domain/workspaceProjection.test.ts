import { describe, expect, it } from "vitest";
import { seedEvents } from "../data/sample";
import { capabilities, learningArtifacts, workspaceSources } from "../data/workspace";
import type { EvidenceEvent } from "./types";
import { reduceWorkspace } from "./workspaceProjection";

describe("workspace projection", () => {
  it("reconstructs the prepared workspace from the evidence stream", () => {
    const workspace = reduceWorkspace(seedEvents);

    expect(workspace.sources).toEqual([...workspaceSources].reverse());
    expect(workspace.learningArtifacts).toEqual(learningArtifacts);
    expect(workspace.explainers[0]?.id).toBe("explainer-value-density");
    expect(workspace.understandingChecks.map((check) => check.kind)).toEqual(
      expect.arrayContaining(["prediction", "transfer"])
    );
    expect(workspace.targetedReviewItems[0]?.sourceIds.length).toBeGreaterThan(0);
    expect(workspace.capabilities).toEqual(capabilities);
    expect(workspace.theory.id).toBe("theory-design-density");
    expect(workspace.memories.human.theoryId).toBe(workspace.theory.id);
  });

  it("projects a multidimensional learning vector without treating recall as transfer", () => {
    const workspace = reduceWorkspace(seedEvents);
    const valueDensity = workspace.understandingEvidenceVectors.find(
      (vector) => vector.theoryElementId === "theory-concept-value-density"
    );

    expect(valueDensity?.dimensions.retrieval.supports).toBe(1);
    expect(valueDensity?.dimensions.transfer.supports).toBe(0);
    expect(valueDensity).not.toHaveProperty("mastery");
  });

  it("is deterministic and does not mutate its input", () => {
    const originalEvents = structuredClone(seedEvents);
    expect(reduceWorkspace(seedEvents)).toEqual(reduceWorkspace(structuredClone(seedEvents)));
    expect(seedEvents).toEqual(originalEvents);
  });

  it("projects newly registered learning artifacts", () => {
    const event: EvidenceEvent = {
      id: "evt-learning-runtime-001",
      type: "learning.artifact_registered",
      kind: "agent_synthesis",
      createdAt: "2026-07-18T12:00:00.000Z",
      actor: "agent",
      summary: "Registered a runtime transfer exercise.",
      sourceIds: ["source-ui-density-2024"],
      payload: {
        artifact: {
          id: "exercise-runtime",
          type: "exercise",
          title: "Apply density principles to a runtime view",
          state: "ready",
          statusLabel: "Ready",
          evidence: "1 source",
          sourceIds: ["source-ui-density-2024"],
          progress: 0
        }
      }
    };

    expect(reduceWorkspace([...seedEvents, event]).learningArtifacts.at(-1)?.id).toBe("exercise-runtime");
  });

  it("rejects incomplete or inconsistent event streams", () => {
    expect(() => reduceWorkspace(seedEvents.filter((event) => event.type !== "workspace.configured"))).toThrow(
      "requires exactly one configuration event"
    );

    const unknownEvaluation: EvidenceEvent = {
      id: "evt-capability-evaluation-unknown",
      type: "capability.evaluation_recorded",
      kind: "validated_behavior",
      createdAt: "2026-07-18T12:01:00.000Z",
      actor: "system",
      summary: "Invalid evaluation for an unknown capability.",
      sourceIds: [],
      payload: { capabilityId: "missing-capability", evaluation: { passed: 1, total: 1 } }
    };

    expect(() => reduceWorkspace([...seedEvents, unknownEvaluation])).toThrow(
      "Cannot evaluate unknown capability missing-capability"
    );

    const missingProvenance: EvidenceEvent = {
      id: "evt-learning-missing-provenance",
      type: "learning.artifact_registered",
      kind: "agent_synthesis",
      createdAt: "2026-07-18T12:02:00.000Z",
      actor: "agent",
      summary: "Invalid learning artifact without event provenance.",
      sourceIds: [],
      payload: {
        artifact: { ...learningArtifacts[0], id: "learning-missing-provenance" }
      }
    };

    expect(() => reduceWorkspace([...seedEvents, missingProvenance])).toThrow("is missing provenance");
  });
});
