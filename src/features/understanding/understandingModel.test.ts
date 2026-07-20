import { describe, expect, it } from "vitest";
import { seedEvents } from "../../data/sample";
import { reduceWorkspace, type WorkspaceProjection } from "../../domain/workspaceProjection";
import { deriveUnderstandingNextAction, deriveUnderstandingWorkspaceState } from "./understandingModel";

function workspace(): WorkspaceProjection {
  return reduceWorkspace(seedEvents);
}

describe("Understanding workspace model", () => {
  it("selects the prepared evidence-backed learning intervention", () => {
    const prepared = workspace();
    const predictionGap = prepared.understandingGaps.gaps.find((gap) => gap.kind === "low_prediction_evidence");
    const action = deriveUnderstandingNextAction(prepared);

    expect(action).toMatchObject({
      destination: { view: "learn", itemId: `check:${predictionGap?.recommendedIntervention.destination.id}` },
      title: predictionGap?.title
    });
    expect(deriveUnderstandingWorkspaceState(prepared, false)).toBe("active");
  });

  it("prioritizes recoverable extraction failure before downstream work", () => {
    const prepared = workspace();
    const failedSource = {
      ...prepared.sources[0],
      status: "failed" as const,
      error: { code: "network", message: "The approved URL could not be fetched.", retryable: true }
    };
    const failed = { ...prepared, sources: [failedSource, ...prepared.sources.slice(1)] };

    expect(deriveUnderstandingNextAction(failed)).toMatchObject({
      destination: { view: "sources", sourceId: failedSource.id },
      label: "Open source recovery"
    });
    expect(deriveUnderstandingWorkspaceState(failed, false)).toBe("extraction-failure");
  });

  it("surfaces a failed first source before the empty-theory state", () => {
    const prepared = workspace();
    const failedSource = {
      ...prepared.sources[0],
      status: "failed" as const,
      error: { code: "network", message: "The first source could not be fetched.", retryable: true }
    };
    const failedFirstSource = {
      ...prepared,
      sources: [failedSource],
      theory: { ...prepared.theory, elements: [], relationships: [], evidenceEventIds: [] }
    };

    expect(deriveUnderstandingWorkspaceState(failedFirstSource, false)).toBe("extraction-failure");
    expect(deriveUnderstandingNextAction(failedFirstSource)).toMatchObject({
      destination: { view: "sources", sourceId: failedSource.id },
      label: "Open source recovery"
    });
  });

  it("distinguishes loading, empty, contradiction, stale, and completed states", () => {
    const prepared = workspace();
    const empty = { ...prepared, theory: { ...prepared.theory, elements: [] } };
    const contradiction = {
      ...prepared,
      memories: {
        ...prepared.memories,
        shared: { ...prepared.memories.shared, contradictionTheoryElementIds: [prepared.theory.elements[0].id] }
      }
    };
    const stale = {
      ...prepared,
      memories: {
        ...prepared.memories,
        shared: { ...prepared.memories.shared, staleTheoryElementIds: [prepared.theory.elements[0].id] }
      }
    };
    const completed = {
      ...prepared,
      understandingGaps: { gaps: [], openCount: 0, confirmedCount: 0, dismissedCount: 0 },
      understandingChecks: [],
      microWorlds: [],
      capabilities: prepared.capabilities.map((capability) => ({
        ...capability,
        manifest: { ...capability.manifest, status: "active" as const }
      })),
      memories: {
        ...prepared.memories,
        shared: {
          ...prepared.memories.shared,
          contradictionTheoryElementIds: [],
          staleTheoryElementIds: []
        }
      }
    };

    expect(deriveUnderstandingWorkspaceState(prepared, true)).toBe("loading");
    expect(deriveUnderstandingWorkspaceState(empty, false)).toBe("empty");
    expect(deriveUnderstandingWorkspaceState(contradiction, false)).toBe("contradiction");
    expect(deriveUnderstandingWorkspaceState(stale, false)).toBe("stale");
    expect(deriveUnderstandingWorkspaceState(completed, false)).toBe("completed");
    expect(deriveUnderstandingNextAction(completed)).not.toHaveProperty("destination");
  });
});
