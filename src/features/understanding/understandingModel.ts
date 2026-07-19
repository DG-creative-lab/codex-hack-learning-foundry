import type { UnderstandingGapDestination } from "../../domain/understandingGaps";
import type { WorkspaceProjection } from "../../domain/workspaceProjection";

export type UnderstandingWorkspaceState =
  | "active"
  | "empty"
  | "loading"
  | "extraction-failure"
  | "contradiction"
  | "stale"
  | "completed";

export type UnderstandingNextAction =
  | {
      kind: "source";
      id: string;
      label: string;
      title: string;
      why: string;
    }
  | {
      kind: "learning";
      id: string;
      label: string;
      title: string;
      why: string;
    }
  | {
      kind: "memory";
      id: string;
      label: string;
      title: string;
      why: string;
    }
  | {
      kind: "foundry";
      id: string;
      label: string;
      title: string;
      why: string;
    }
  | {
      kind: "complete";
      label: string;
      title: string;
      why: string;
    };

function actionFromGap(destination: UnderstandingGapDestination, label: string, title: string, why: string) {
  if (destination.kind === "check") {
    return { kind: "learning", id: `check:${destination.id}`, label, title, why } as const;
  }
  if (destination.kind === "micro-world") {
    return { kind: "learning", id: `micro-world:${destination.id}`, label, title, why } as const;
  }
  if (destination.kind === "theory-element") {
    return { kind: "memory", id: destination.id, label, title, why } as const;
  }
  return { kind: "foundry", id: destination.id, label, title, why } as const;
}

export function deriveUnderstandingNextAction(workspace: WorkspaceProjection): UnderstandingNextAction {
  const failedSource = workspace.sources.find((source) => source.status === "failed");
  if (failedSource) {
    return {
      kind: "source",
      id: failedSource.id,
      label: failedSource.error?.retryable ? "Retry extraction" : "Inspect source",
      title: `Recover ${failedSource.title}`,
      why: failedSource.error?.message ?? "The source could not enter the shared theory."
    };
  }

  const processingSource = workspace.sources.find((source) => ["queued", "processing"].includes(source.status));
  if (processingSource) {
    return {
      kind: "source",
      id: processingSource.id,
      label: "Inspect extraction",
      title: `${processingSource.title} is being processed`,
      why: "Theory and learning actions remain provisional until extraction finishes."
    };
  }

  const proposal = workspace.synthesisProposals.find((candidate) => candidate.status === "pending");
  if (proposal) {
    const source = workspace.sources.find((candidate) => candidate.id === proposal.sourceId);
    return {
      kind: "source",
      id: proposal.sourceId,
      label: "Review synthesis",
      title: `Decide what enters the Living Theory`,
      why: `${source?.title ?? "A source"} has a traceable proposal awaiting human review.`
    };
  }

  const openGap = workspace.understandingGaps.gaps.find((gap) => gap.status === "open");
  if (openGap) {
    return actionFromGap(
      openGap.recommendedIntervention.destination,
      openGap.recommendedIntervention.label,
      openGap.title,
      openGap.why
    );
  }

  const readyCheck = workspace.understandingChecks.find(
    (check) => check.status === "ready" && check.attempts.length === 0
  );
  if (readyCheck) {
    return {
      kind: "learning",
      id: `check:${readyCheck.id}`,
      label: `Open ${readyCheck.kind.replace("_", " ")}`,
      title: readyCheck.prompt,
      why: "A durable response will add human evidence to the theory elements this task covers."
    };
  }

  const unobservedWorld = workspace.microWorlds.find((world) => world.interactions.length === 0);
  if (unobservedWorld) {
    return {
      kind: "learning",
      id: `micro-world:${unobservedWorld.id}`,
      label: "Open micro-world",
      title: unobservedWorld.title,
      why: "A prediction and linked observation can make the model's trade-offs inspectable."
    };
  }

  const capability = workspace.capabilities.find(
    (candidate) => !["approved", "active"].includes(candidate.manifest.status)
  );
  if (capability) {
    return {
      kind: "foundry",
      id: capability.manifest.id,
      label: "Inspect capability",
      title: capability.manifest.name,
      why: "The capability remains distinct from understanding until its evidence and evaluation are inspected."
    };
  }

  return {
    kind: "complete",
    label: "Review the evidence trail",
    title: "The prepared journey is complete",
    why: "No bounded detector currently identifies a more meaningful next action."
  };
}

export function deriveUnderstandingWorkspaceState(
  workspace: WorkspaceProjection,
  loading: boolean
): UnderstandingWorkspaceState {
  if (loading) return "loading";
  if (workspace.theory.elements.filter((element) => element.status !== "superseded").length === 0) return "empty";
  if (workspace.sources.some((source) => source.status === "failed")) return "extraction-failure";
  if (workspace.memories.shared.contradictionTheoryElementIds.length > 0) return "contradiction";
  if (workspace.memories.shared.staleTheoryElementIds.length > 0) return "stale";
  if (deriveUnderstandingNextAction(workspace).kind === "complete") return "completed";
  return "active";
}
