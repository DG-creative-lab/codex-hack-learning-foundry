import type { EvidenceKind } from "../domain/types";
import { foundryCapabilitySchema, learningArtifactSchema, sourceRecordSchema } from "../domain/workspaceEntities";

export interface KnowledgeAtom {
  id: string;
  title: string;
  epistemicKind: EvidenceKind;
  confidence: number;
  sourceIds: string[];
  relation: string;
}

export const workspaceSources = sourceRecordSchema.array().parse([
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
    currentVersionId: "source-dense-by-design-v-111111111111",
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
]);

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

export const learningArtifacts = learningArtifactSchema.array().parse([
  {
    id: "lesson-density",
    type: "lesson",
    title: "Five lenses of interface density",
    state: "in-progress",
    statusLabel: "In progress",
    evidence: "2 sources / 12 atoms",
    sourceIds: ["source-ui-density-2024", "source-dense-by-design"],
    progress: 64
  },
  {
    id: "exercise-queue",
    type: "exercise",
    title: "Diagnose an operational queue",
    state: "ready",
    statusLabel: "Ready",
    evidence: "1 transfer task",
    sourceIds: ["source-ui-density-2024"],
    progress: 0
  },
  {
    id: "review-density",
    type: "review",
    title: "Density distinctions",
    state: "due",
    statusLabel: "Due tomorrow",
    evidence: "5 recall items",
    sourceIds: ["source-ui-density-2024", "source-dense-by-design"],
    progress: 20
  },
  {
    id: "reflection-taste",
    type: "reflection",
    title: "Separate taste from observed value",
    state: "ready",
    statusLabel: "Ready",
    evidence: "Personal preference",
    sourceIds: [],
    progress: 0
  }
]);

export const capabilities = foundryCapabilitySchema.array().parse([
  {
    manifest: {
      id: "value-density-reviewer",
      name: "value-density-reviewer",
      type: "skill",
      version: "0.1.0",
      status: "evaluated",
      createdAt: "2026-07-14T10:00:00.000Z",
      sourceIds: ["source-ui-density-2024", "source-dense-by-design", "source-wcag-target-size"],
      assumptions: ["The reviewed interface has an identifiable user objective."],
      limitations: ["The review does not replace usability testing."],
      evaluationFixture: "tests/fixtures/value-density/passing-review.json",
      skillPath: "skills/value-density-reviewer"
    },
    evaluation: { passed: 8, total: 8 },
    executions: 1
  },
  {
    manifest: {
      id: "design-knowledge",
      name: "design-density-knowledge",
      type: "knowledge-module",
      version: "0.1.0",
      status: "synthesized",
      createdAt: "2026-07-14T10:05:00.000Z",
      sourceIds: ["source-ui-density-2024", "source-dense-by-design", "source-wcag-target-size"],
      assumptions: ["Source claims remain traceable to their evidence."],
      limitations: ["The module covers interface density only."],
      skillPath: "knowledge/design-density"
    },
    evaluation: null,
    executions: 0
  },
  {
    manifest: {
      id: "density-linter",
      name: "density-constraint-linter",
      type: "tool",
      version: "proposal",
      status: "captured",
      createdAt: "2026-07-14T10:10:00.000Z",
      sourceIds: ["source-wcag-target-size"],
      assumptions: ["Machine-readable constraints can supplement design review."],
      limitations: ["The proposal has not been sandboxed or evaluated."],
      skillPath: "tools/density-constraint-linter"
    },
    evaluation: null,
    executions: 0
  }
]);
