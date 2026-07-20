import { describe, expect, it } from "vitest";
import { destinationForView, destinationFromUnderstandingGap } from "./workspaceNavigation";

describe("workspace navigation contract", () => {
  it("represents untargeted operational views without inventing entity context", () => {
    for (const view of ["sources", "understanding", "learn", "memory", "foundry", "about"] as const) {
      expect(destinationForView(view)).toEqual({ view });
    }
  });

  it("maps every understanding-gap target to an exact workspace destination", () => {
    expect(destinationFromUnderstandingGap({ kind: "check", view: "learn", id: "check-1" })).toEqual({
      view: "learn",
      itemId: "check:check-1"
    });
    expect(destinationFromUnderstandingGap({ kind: "micro-world", view: "learn", id: "world-1" })).toEqual({
      view: "learn",
      itemId: "micro-world:world-1"
    });
    expect(destinationFromUnderstandingGap({ kind: "theory-element", view: "memory", id: "theory-1" })).toEqual({
      view: "memory",
      theoryElementId: "theory-1"
    });
    expect(destinationFromUnderstandingGap({ kind: "capability", view: "foundry", id: "skill-1" })).toEqual({
      view: "foundry",
      capabilityId: "skill-1"
    });
  });
});
