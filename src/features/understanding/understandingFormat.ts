import type { TheoryElement } from "../../domain/types";
import type { WorkspaceProjection } from "../../domain/workspaceProjection";

export const theoryKindLabels: Record<TheoryElement["kind"], string> = {
  purpose: "Purpose",
  concept: "Concept",
  claim: "Claim",
  causal_model: "Causal model",
  decision: "Decision",
  assumption: "Assumption",
  boundary: "Boundary",
  contradiction: "Contradiction",
  question: "Question"
};

export function sourceLocationLabel(location: WorkspaceProjection["sourceFragments"][number]["location"]): string {
  if (location.page) return `Page ${location.page}`;
  if (location.lineStart) return `Lines ${location.lineStart}${location.lineEnd ? `-${location.lineEnd}` : ""}`;
  return location.label;
}
