import type { SourceRecord } from "../domain/sourceProjection";
import type { CapabilityStatus, EvidenceKind } from "../domain/types";

export interface KnowledgeAtom {
  id: string;
  title: string;
  epistemicKind: EvidenceKind;
  confidence: number;
  sourceIds: string[];
  relation: string;
}

export const workspaceSources: SourceRecord[] = [
  {
    id: "source-ui-density-2024",
    title: "UI Density",
    author: "Matthew Ström-Awn",
    origin: "web",
    format: "Article",
    status: "ready",
    progress: 100,
    addedAt: "14 Jul 2026",
    provenance: "mattstromawn.com/writing/ui-density",
    outputs: { atoms: 12, lessons: 1, capabilities: 1 }
  },
  {
    id: "source-dense-by-design",
    title: "Dense by Design",
    author: "Matthew Ström-Awn / Config 2026",
    origin: "local",
    format: "Transcript",
    status: "ready",
    progress: 100,
    addedAt: "14 Jul 2026",
    provenance: "User-provided local transcript; not redistributed",
    outputs: { atoms: 9, lessons: 1, capabilities: 1 }
  },
  {
    id: "source-wcag-target-size",
    title: "WCAG 2.2: Target Size",
    author: "W3C Web Accessibility Initiative",
    origin: "web",
    format: "Standard",
    status: "ready",
    progress: 100,
    addedAt: "14 Jul 2026",
    provenance: "w3.org/WAI/WCAG22",
    outputs: { atoms: 6, lessons: 0, capabilities: 1 }
  }
];

export const knowledgeAtoms: KnowledgeAtom[] = [
  {
    id: "atom-visual",
    title: "Visual density is perceptual, not evaluative",
    epistemicKind: "source_fact",
    confidence: 0.94,
    sourceIds: ["source-ui-density-2024", "source-dense-by-design"],
    relation: "defines"
  },
  {
    id: "atom-information",
    title: "Useful information and visible marks are not equivalent",
    epistemicKind: "source_fact",
    confidence: 0.91,
    sourceIds: ["source-ui-density-2024"],
    relation: "supports"
  },
  {
    id: "atom-meaning",
    title: "Arrangement can add meaning without adding content",
    epistemicKind: "agent_synthesis",
    confidence: 0.83,
    sourceIds: ["source-ui-density-2024", "source-dense-by-design"],
    relation: "generalizes-to"
  },
  {
    id: "atom-time",
    title: "Workflow time is a design material",
    epistemicKind: "source_fact",
    confidence: 0.89,
    sourceIds: ["source-ui-density-2024"],
    relation: "applies-to"
  },
  {
    id: "atom-taste",
    title: "Prefer compact operational layouts with explicit hierarchy",
    epistemicKind: "user_interpretation",
    confidence: 0.72,
    sourceIds: [],
    relation: "preference-for"
  },
  {
    id: "atom-access",
    title: "Density changes remain bounded by target-size constraints",
    epistemicKind: "validated_behavior",
    confidence: 0.96,
    sourceIds: ["source-wcag-target-size"],
    relation: "constrained-by"
  }
];

export const learningArtifacts = [
  {
    id: "lesson-density",
    type: "Lesson",
    title: "Five lenses of interface density",
    status: "In progress",
    evidence: "2 sources / 12 atoms",
    progress: 64
  },
  {
    id: "exercise-queue",
    type: "Exercise",
    title: "Diagnose an operational queue",
    status: "Ready",
    evidence: "1 transfer task",
    progress: 0
  },
  {
    id: "review-density",
    type: "Review set",
    title: "Density distinctions",
    status: "Due tomorrow",
    evidence: "5 recall items",
    progress: 20
  },
  {
    id: "reflection-taste",
    type: "Reflection",
    title: "Separate taste from observed value",
    status: "Ready",
    evidence: "Personal preference",
    progress: 0
  }
];

interface CapabilityRecord {
  id: string;
  name: string;
  type: string;
  version: string;
  status: CapabilityStatus;
  sources: number;
  evaluations: string;
  executions: number;
}

export const capabilities: CapabilityRecord[] = [
  {
    id: "value-density-reviewer",
    name: "value-density-reviewer",
    type: "Skill",
    version: "0.1.0",
    status: "evaluated",
    sources: 3,
    evaluations: "8 / 8",
    executions: 1
  },
  {
    id: "design-knowledge",
    name: "design-density-knowledge",
    type: "Knowledge module",
    version: "0.1.0",
    status: "synthesized",
    sources: 3,
    evaluations: "—",
    executions: 0
  },
  {
    id: "density-linter",
    name: "density-constraint-linter",
    type: "Tool",
    version: "proposal",
    status: "captured",
    sources: 1,
    evaluations: "—",
    executions: 0
  }
];
