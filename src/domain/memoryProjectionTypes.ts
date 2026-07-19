import { z } from "zod";
import type { EvidenceKind, TheoryElement } from "./types";
import type { UnderstandingSignal } from "./understandingChecks";
import type { FoundryCapability } from "./workspaceEntities";

export const humanMemoryDimensionSchema = z.enum([
  "recall",
  "explanation",
  "prediction",
  "transfer",
  "participation",
  "uncertainty"
]);

export type HumanMemoryDimension = z.infer<typeof humanMemoryDimensionSchema>;
export type MemoryFreshness = "current" | "stale" | "unobserved";
export type SharedTheoryAgreement = "supported" | "partial" | "contested" | "unresolved";

export interface MemoryEvidenceReference {
  eventId: string;
  createdAt: string;
  kind: EvidenceKind;
  summary: string;
  sourceIds: string[];
  signal: UnderstandingSignal;
  rationale: string;
}

export interface HumanDimensionProjection {
  dimension: HumanMemoryDimension;
  supportingEvidence: MemoryEvidenceReference[];
  mixedEvidence: MemoryEvidenceReference[];
  contradictoryEvidence: MemoryEvidenceReference[];
  lastObservedAt?: string;
  freshness: MemoryFreshness;
}

export interface HumanTheoryProjection {
  theoryElementId: string;
  title: string;
  dimensions: Record<HumanMemoryDimension, HumanDimensionProjection>;
  supportingEvidence: MemoryEvidenceReference[];
  contradictoryEvidence: MemoryEvidenceReference[];
  lastObservedAt?: string;
  freshness: MemoryFreshness;
}

export interface HumanMemoryProjection {
  theoryId: string;
  theoryElementIds: string[];
  contributedTheoryElementIds: string[];
  elements: HumanTheoryProjection[];
  supportingEvidence: MemoryEvidenceReference[];
  mixedEvidence: MemoryEvidenceReference[];
  contradictoryEvidence: MemoryEvidenceReference[];
  staleTheoryElementIds: string[];
}

export interface AgentTheoryMemoryItem {
  theoryElementId: string;
  title: string;
  kind: TheoryElement["kind"];
  sourceIds: string[];
  evidenceEventIds: string[];
  lastObservedAt?: string;
  freshness: MemoryFreshness;
}

export interface AgentCapabilityVersion {
  capabilityId: string;
  name: string;
  version: string;
  status: FoundryCapability["manifest"]["status"];
  evidenceEventId?: string;
  createdAt: string;
  freshness: MemoryFreshness;
}

export interface AgentCapabilityEvaluation {
  capabilityId: string;
  passed: number;
  total: number;
  evidence: MemoryEvidenceReference;
  freshness: MemoryFreshness;
}

export interface AgentFailure {
  capabilityId?: string;
  failedCases?: number;
  evidence: MemoryEvidenceReference;
}

export interface AgentMemoryProjection {
  theoryId: string;
  theoryElementIds: string[];
  contributedTheoryElementIds: string[];
  knowledge: AgentTheoryMemoryItem[];
  assumptions: AgentTheoryMemoryItem[];
  boundaries: AgentTheoryMemoryItem[];
  decisions: AgentTheoryMemoryItem[];
  evaluations: AgentCapabilityEvaluation[];
  failures: AgentFailure[];
  capabilityVersions: AgentCapabilityVersion[];
  supportingEvidence: MemoryEvidenceReference[];
  contradictoryEvidence: MemoryEvidenceReference[];
  staleTheoryElementIds: string[];
}

export interface SharedTheoryElementProjection {
  theoryElementId: string;
  title: string;
  kind: TheoryElement["kind"];
  status: TheoryElement["status"];
  agreement: SharedTheoryAgreement;
  coverage: { source: boolean; human: boolean; agent: boolean };
  supportingEvidence: MemoryEvidenceReference[];
  contradictoryEvidence: MemoryEvidenceReference[];
  lastObservedAt?: string;
  freshness: MemoryFreshness;
}

export interface SharedTheoryProjection {
  theoryId: string;
  elements: SharedTheoryElementProjection[];
  unresolvedTheoryElementIds: string[];
  contradictionTheoryElementIds: string[];
  staleTheoryElementIds: string[];
  supportingEvidence: MemoryEvidenceReference[];
  contradictoryEvidence: MemoryEvidenceReference[];
}

export interface MemoryProjections {
  asOf: string;
  human: HumanMemoryProjection;
  agent: AgentMemoryProjection;
  shared: SharedTheoryProjection;
}
