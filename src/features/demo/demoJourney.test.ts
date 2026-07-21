import { describe, expect, it } from "vitest";
import { seedEvents } from "../../data/sample";
import { reduceWorkspace } from "../../domain/workspaceProjection";
import { type DemoStageId, deriveDemoJourney } from "./demoJourney";

describe("prepared demo journey", () => {
  it("starts with source inspection and routes every prepared artifact explicitly", () => {
    const journey = deriveDemoJourney(reduceWorkspace(seedEvents), new Set());

    expect(journey.current.id).toBe("source");
    expect(journey.stages.map((stage) => stage.destination)).toEqual([
      { view: "sources", sourceId: "source-dense-by-design" },
      { view: "understanding", theoryElementId: "theory-purpose-review-value" },
      { view: "learn", itemId: "explainer:explainer-value-density" },
      { view: "learn", itemId: "micro-world:micro-world-density-queue" },
      expect.objectContaining({ view: "learn", itemId: expect.stringMatching(/^check:/) }),
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
});
