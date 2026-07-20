import { destinationFromUnderstandingGap, type WorkspaceDestination } from "../../application/workspaceNavigation";
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
      destination: WorkspaceDestination;
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
  return { destination: destinationFromUnderstandingGap(destination), label, title, why } as const;
}

export function deriveUnderstandingNextAction(workspace: WorkspaceProjection): UnderstandingNextAction {
  const failedSource = workspace.sources.find((source) => source.status === "failed");
  if (failedSource) {
    return {
      destination: { view: "sources", sourceId: failedSource.id },
      label: failedSource.error?.retryable ? "Open source recovery" : "Inspect source",
      title: `Recover ${failedSource.title}`,
      why: failedSource.error?.message ?? "The source could not enter the shared theory."
    };
  }

  const processingSource = workspace.sources.find((source) => ["queued", "processing"].includes(source.status));
  if (processingSource) {
    return {
      destination: { view: "sources", sourceId: processingSource.id },
      label: "Inspect extraction",
      title: `${processingSource.title} is being processed`,
      why: "Theory and learning actions remain provisional until extraction finishes."
    };
  }

  const proposal = workspace.synthesisProposals.find((candidate) => candidate.status === "pending");
  if (proposal) {
    const source = workspace.sources.find((candidate) => candidate.id === proposal.sourceId);
    return {
      destination: { view: "sources", sourceId: proposal.sourceId },
      label: "Review synthesis",
      title: `Decide what enters the Living Theory`,
      why: `${source?.title ?? "A source"} has a traceable proposal awaiting human review.`
    };
  }

  const practicalEventIds = new Set([
    ...workspace.practicalEvidence.applications.map((item) => item.evidenceEventId),
    ...workspace.practicalEvidence.feedback.map((item) => item.evidenceEventId),
    ...workspace.microWorlds.flatMap((world) => [
      ...world.interactions.map((item) => item.evidenceEventId),
      ...world.reflections.map((item) => item.evidenceEventId)
    ])
  ]);
  const consolidationReview = workspace.targetedReviewItems.find((item) => practicalEventIds.has(item.attemptEventId));
  if (consolidationReview) {
    return {
      destination: { view: "learn", itemId: `check:${consolidationReview.checkId}` },
      label: "Open targeted review",
      title: consolidationReview.title,
      why: "Recorded practical evidence created focused follow-up learning before further capability revision."
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
      destination: { view: "learn", itemId: `check:${readyCheck.id}` },
      label: `Open ${readyCheck.kind.replace("_", " ")}`,
      title: readyCheck.prompt,
      why: "A durable response will add human evidence to the theory elements this task covers."
    };
  }

  const unobservedWorld = workspace.microWorlds.find((world) => world.interactions.length === 0);
  if (unobservedWorld) {
    return {
      destination: { view: "learn", itemId: `micro-world:${unobservedWorld.id}` },
      label: "Open micro-world",
      title: unobservedWorld.title,
      why: "A prediction and linked observation can make the model's trade-offs inspectable."
    };
  }

  const capability = workspace.capabilities.find(
    (candidate) => !["active", "rejected", "superseded"].includes(candidate.manifest.status)
  );
  if (capability) {
    return {
      destination: { view: "foundry", capabilityId: capability.manifest.id },
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
  if (workspace.sources.some((source) => source.status === "failed")) return "extraction-failure";
  if (workspace.theory.elements.filter((element) => element.status !== "superseded").length === 0) return "empty";
  if (workspace.memories.shared.contradictionTheoryElementIds.length > 0) return "contradiction";
  if (workspace.memories.shared.staleTheoryElementIds.length > 0) return "stale";
  if (!("destination" in deriveUnderstandingNextAction(workspace))) return "completed";
  return "active";
}
