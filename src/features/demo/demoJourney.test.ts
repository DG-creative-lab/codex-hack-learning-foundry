import { describe, expect, it } from "vitest";
import { seedEvents } from "../../data/sample";
import { reduceWorkspace } from "../../domain/workspaceProjection";
import { type DemoStageId, deriveDemoJourney, designDensityPreparedDemo } from "./demoJourney";

describe("prepared demo journey", () => {
  it("starts with source inspection and routes every prepared artifact explicitly", () => {
    const journey = deriveDemoJourney(reduceWorkspace(seedEvents), new Set());

    expect(journey.current.id).toBe("source");
    expect(journey.stages.map((stage) => stage.destination)).toEqual([
      { view: "sources", sourceId: "source-dense-by-design" },
      { view: "understanding", theoryElementId: "theory-purpose-review-value" },
      { view: "learn", itemId: "explainer:explainer-value-density" },
      { view: "learn", itemId: "micro-world:micro-world-density-queue" },
      { view: "learn", itemId: "check:check-theory-design-density-transfer-c1" },
      { view: "foundry", capabilityId: "value-density-reviewer" },
      { view: "foundry", capabilityId: "value-density-reviewer" },
      { view: "foundry", capabilityId: "value-density-reviewer" }
    ]);
  });

  it("does not treat inspection as canonical evidence and advances to the first durable experiment", () => {
    const visited = new Set<DemoStageId>(["source", "theory", "explainer"]);
    const journey = deriveDemoJourney(reduceWorkspace(seedEvents), visited);

    expect(journey.completedCount).toBe(3);
    expect(journey.current.id).toBe("experiment");
    expect(journey.current.durableEvidence).toBe(true);
  });

  it("does not fall back to unrelated artifacts when a prepared artifact is missing", () => {
    const workspace = reduceWorkspace(seedEvents);
    const withoutPreparedArtifacts = {
      ...workspace,
      sources: workspace.sources.filter((source) => source.id !== designDensityPreparedDemo.artifacts.sourceId),
      theory: {
        ...workspace.theory,
        elements: workspace.theory.elements.filter(
          (element) => element.id !== designDensityPreparedDemo.artifacts.theoryElementId
        )
      },
      explainers: workspace.explainers.filter(
        (explainer) => explainer.id !== designDensityPreparedDemo.artifacts.explainerId
      ),
      microWorlds: workspace.microWorlds.filter(
        (world) => world.id !== designDensityPreparedDemo.artifacts.microWorldId
      ),
      understandingChecks: workspace.understandingChecks.filter(
        (check) => check.id !== designDensityPreparedDemo.artifacts.transferCheckId
      ),
      capabilities: workspace.capabilities.filter(
        (capability) => capability.manifest.id !== designDensityPreparedDemo.artifacts.capabilityId
      )
    };
    const journey = deriveDemoJourney(
      withoutPreparedArtifacts,
      new Set<DemoStageId>(["source", "theory", "explainer"])
    );

    expect(journey.current.id).toBe("source");
    expect(journey.completedCount).toBe(0);
    expect(journey.stages.slice(3).every((stage) => stage.state !== "complete")).toBe(true);
    expect(journey.stages[0].destination).toEqual({
      view: "sources",
      sourceId: designDensityPreparedDemo.artifacts.sourceId
    });
  });
});
