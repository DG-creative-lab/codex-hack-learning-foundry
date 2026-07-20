import type { UnderstandingGapDestination } from "../domain/understandingGaps";

export type WorkspaceView = "sources" | "understanding" | "learn" | "memory" | "foundry" | "about";

export type WorkspaceDestination =
  | { view: "sources"; sourceId?: string }
  | { view: "understanding"; theoryElementId?: string }
  | { view: "learn"; itemId?: string }
  | { view: "memory"; theoryElementId?: string }
  | { view: "foundry"; capabilityId?: string }
  | { view: "about" };

const untargetedDestinations = {
  sources: { view: "sources" },
  understanding: { view: "understanding" },
  learn: { view: "learn" },
  memory: { view: "memory" },
  foundry: { view: "foundry" },
  about: { view: "about" }
} as const satisfies Record<WorkspaceView, WorkspaceDestination>;

export function destinationForView(view: WorkspaceView): WorkspaceDestination {
  return untargetedDestinations[view];
}

export function destinationFromUnderstandingGap(destination: UnderstandingGapDestination): WorkspaceDestination {
  switch (destination.kind) {
    case "check":
      return { view: "learn", itemId: `check:${destination.id}` };
    case "micro-world":
      return { view: "learn", itemId: `micro-world:${destination.id}` };
    case "theory-element":
      return { view: "memory", theoryElementId: destination.id };
    case "capability":
      return { view: "foundry", capabilityId: destination.id };
  }
}
