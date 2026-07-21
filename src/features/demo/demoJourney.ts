import type { WorkspaceDestination } from "../../application/workspaceNavigation";
import type { WorkspaceProjection } from "../../domain/workspaceProjection";
import { designDensityPreparedDemo } from "./designDensityPreparedDemo";

export { designDensityPreparedDemo } from "./designDensityPreparedDemo";

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

export type DemoCompletionPredicate = (
  workspace: WorkspaceProjection,
  visitedInspectionStages: ReadonlySet<DemoStageId>,
  definition: PreparedDemoDefinition
) => boolean;

export interface PreparedDemoDefinition {
  id: string;
  artifacts: {
    sourceId: string;
    theoryElementId: string;
    explainerId: string;
    microWorldId: string;
    microWorldPredictionOptionId: string;
    transferCheckId: string;
    capabilityId: string;
    capabilityVersion: string;
    preparedAdapterVersion: string;
    revisionTheoryElementId: string;
  };
  completion: Record<DemoStageId, DemoCompletionPredicate>;
}

export function deriveDemoJourney(
  workspace: WorkspaceProjection,
  visitedInspectionStages: ReadonlySet<DemoStageId>,
  definition: PreparedDemoDefinition = designDensityPreparedDemo
): DemoJourneyProjection {
  const { artifacts, completion } = definition;

  const definitions: Array<Omit<DemoJourneyStage, "state"> & { complete: boolean }> = [
    {
      id: "source",
      shortLabel: "Source",
      title: "Inspect the prepared sources",
      why: "Start from the approved talk and supporting evidence before reading any synthesis.",
      destination: { view: "sources", sourceId: artifacts.sourceId },
      durableEvidence: false,
      complete: completion.source(workspace, visitedInspectionStages, definition)
    },
    {
      id: "theory",
      shortLabel: "Theory",
      title: "Inspect the Living Theory",
      why: "Trace the shared model back to source fragments and unresolved questions.",
      destination: { view: "understanding", theoryElementId: artifacts.theoryElementId },
      durableEvidence: false,
      complete: completion.theory(workspace, visitedInspectionStages, definition)
    },
    {
      id: "explainer",
      shortLabel: "Explain",
      title: "Build the human model",
      why: "Read the project-grounded explanation before testing the model in action.",
      destination: { view: "learn", itemId: `explainer:${artifacts.explainerId}` },
      durableEvidence: false,
      complete: completion.explainer(workspace, visitedInspectionStages, definition)
    },
    {
      id: "experiment",
      shortLabel: "Explore",
      title: "Predict, observe, and reflect",
      why: "Record all three evidence types in the density micro-world; unsaved slider movement does not count.",
      destination: { view: "learn", itemId: `micro-world:${artifacts.microWorldId}` },
      durableEvidence: true,
      complete: completion.experiment(workspace, visitedInspectionStages, definition)
    },
    {
      id: "transfer",
      shortLabel: "Transfer",
      title: "Apply the model to a new interface",
      why: "A transfer response shows whether the theory is available beyond its original cues.",
      destination: { view: "learn", itemId: `check:${artifacts.transferCheckId}` },
      durableEvidence: true,
      complete: completion.transfer(workspace, visitedInspectionStages, definition)
    },
    {
      id: "capability",
      shortLabel: "Approve",
      title: "Inspect and activate the capability",
      why: "Review provenance, boundaries, evaluations, and understanding evidence before granting authority.",
      destination: { view: "foundry", capabilityId: artifacts.capabilityId },
      durableEvidence: true,
      complete: completion.capability(workspace, visitedInspectionStages, definition)
    },
    {
      id: "application",
      shortLabel: "Apply",
      title: "Run the prepared design review",
      why: "Apply the approved capability to a new UI task and inspect its bounded execution trace.",
      destination: { view: "foundry", capabilityId: artifacts.capabilityId },
      durableEvidence: true,
      complete: completion.application(workspace, visitedInspectionStages, definition)
    },
    {
      id: "revision",
      shortLabel: "Revise",
      title: "Correct and consolidate",
      why: "Turn practical feedback into targeted review, a theory revision, and a capability revision request.",
      destination: { view: "foundry", capabilityId: artifacts.capabilityId },
      durableEvidence: true,
      complete: completion.revision(workspace, visitedInspectionStages, definition)
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
