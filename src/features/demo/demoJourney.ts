import type { WorkspaceDestination } from "../../application/workspaceNavigation";
import type { WorkspaceProjection } from "../../domain/workspaceProjection";

export const demoStageIds = [
  "source",
  "theory",
  "explainer",
  "experiment",
  "transfer",
  "capability",
  "application",
  "revision"
] as const;

export type DemoStageId = (typeof demoStageIds)[number];
export type DemoStageState = "complete" | "current" | "available";

export interface DemoJourneyStage {
  id: DemoStageId;
  shortLabel: string;
  title: string;
  why: string;
  destination: WorkspaceDestination;
  state: DemoStageState;
  durableEvidence: boolean;
}

export interface DemoJourneyProjection {
  stages: DemoJourneyStage[];
  current: DemoJourneyStage;
  completedCount: number;
}

function hasCompletedExperiment(workspace: WorkspaceProjection) {
  return workspace.microWorlds.some((world) =>
    world.interactions.some((interaction) =>
      world.reflections.some((reflection) => reflection.interactionEventId === interaction.evidenceEventId)
    )
  );
}

function hasCompleteRevision(workspace: WorkspaceProjection) {
  return workspace.consolidationProposals.some(
    (proposal) =>
      proposal.status === "approved" &&
      proposal.reviewItems.length > 0 &&
      proposal.theoryRevisions.length > 0 &&
      proposal.capabilityRevisionRequests.length > 0
  );
}

export function deriveDemoJourney(
  workspace: WorkspaceProjection,
  visitedInspectionStages: ReadonlySet<DemoStageId>
): DemoJourneyProjection {
  const preparedSource =
    workspace.sources.find((source) => source.id === "source-dense-by-design") ?? workspace.sources[0];
  const purpose =
    workspace.theory.elements.find((element) => element.status !== "superseded" && element.kind === "purpose") ??
    workspace.theory.elements.find((element) => element.status !== "superseded");
  const explainer =
    workspace.explainers.find((artifact) => artifact.id === "explainer-value-density") ?? workspace.explainers[0];
  const microWorld =
    workspace.microWorlds.find((artifact) => artifact.id === "micro-world-density-queue") ?? workspace.microWorlds[0];
  const transfer = workspace.understandingChecks.find((check) => check.kind === "transfer");
  const capability =
    workspace.capabilities.find((candidate) => candidate.manifest.id === "value-density-reviewer") ??
    workspace.capabilities[0];
  const applications = capability
    ? workspace.practicalEvidence.applications.filter(
        (application) => application.capabilityId === capability.manifest.id
      )
    : [];

  const definitions: Array<Omit<DemoJourneyStage, "state"> & { complete: boolean }> = [
    {
      id: "source",
      shortLabel: "Source",
      title: "Inspect the prepared sources",
      why: "Start from the approved talk and supporting evidence before reading any synthesis.",
      destination: { view: "sources", sourceId: preparedSource?.id },
      durableEvidence: false,
      complete: visitedInspectionStages.has("source")
    },
    {
      id: "theory",
      shortLabel: "Theory",
      title: "Inspect the Living Theory",
      why: "Trace the shared model back to source fragments and unresolved questions.",
      destination: { view: "understanding", theoryElementId: purpose?.id },
      durableEvidence: false,
      complete: visitedInspectionStages.has("theory")
    },
    {
      id: "explainer",
      shortLabel: "Explain",
      title: "Build the human model",
      why: "Read the project-grounded explanation before testing the model in action.",
      destination: { view: "learn", itemId: explainer ? `explainer:${explainer.id}` : undefined },
      durableEvidence: false,
      complete: visitedInspectionStages.has("explainer")
    },
    {
      id: "experiment",
      shortLabel: "Explore",
      title: "Predict, observe, and reflect",
      why: "Record all three evidence types in the density micro-world; unsaved slider movement does not count.",
      destination: { view: "learn", itemId: microWorld ? `micro-world:${microWorld.id}` : undefined },
      durableEvidence: true,
      complete: hasCompletedExperiment(workspace)
    },
    {
      id: "transfer",
      shortLabel: "Transfer",
      title: "Apply the model to a new interface",
      why: "A transfer response shows whether the theory is available beyond its original cues.",
      destination: { view: "learn", itemId: transfer ? `check:${transfer.id}` : undefined },
      durableEvidence: true,
      complete: Boolean(transfer?.attempts.length)
    },
    {
      id: "capability",
      shortLabel: "Approve",
      title: "Inspect and activate the capability",
      why: "Review provenance, boundaries, evaluations, and understanding evidence before granting authority.",
      destination: { view: "foundry", capabilityId: capability?.manifest.id },
      durableEvidence: true,
      complete: capability?.manifest.status === "active" || capability?.manifest.status === "superseded"
    },
    {
      id: "application",
      shortLabel: "Apply",
      title: "Run the prepared design review",
      why: "Apply the approved capability to a new UI task and inspect its bounded execution trace.",
      destination: { view: "foundry", capabilityId: capability?.manifest.id },
      durableEvidence: true,
      complete: applications.length > 0
    },
    {
      id: "revision",
      shortLabel: "Revise",
      title: "Correct and consolidate",
      why: "Turn practical feedback into targeted review, a theory revision, and a capability revision request.",
      destination: { view: "foundry", capabilityId: capability?.manifest.id },
      durableEvidence: true,
      complete: hasCompleteRevision(workspace)
    }
  ];

  const currentIndex = definitions.findIndex((stage) => !stage.complete);
  const resolvedCurrentIndex = currentIndex < 0 ? definitions.length - 1 : currentIndex;
  const stages = definitions.map(
    ({ complete, ...stage }, index): DemoJourneyStage => ({
      ...stage,
      state: complete ? "complete" : index === resolvedCurrentIndex ? "current" : "available"
    })
  );

  return {
    stages,
    current: stages[resolvedCurrentIndex],
    completedCount: definitions.filter((stage) => stage.complete).length
  };
}
