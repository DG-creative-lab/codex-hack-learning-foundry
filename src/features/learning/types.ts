import type { ExplainerFeedback } from "../../domain/explainer";
import type { MicroWorldVariableValues } from "../../domain/microWorld";
import type { NormalizedSourceFragment } from "../../domain/sourcePipeline";
import type {
  CheckPreference,
  EvaluationDispute,
  UnderstandingEvidenceVector,
  UnderstandingResponse
} from "../../domain/understandingChecks";
import type { SourceRecord } from "../../domain/workspaceEntities";

export type FragmentIndex = ReadonlyMap<string, NormalizedSourceFragment>;
export type SourceIndex = ReadonlyMap<string, SourceRecord>;
export type RecordExplainerFeedback = (artifactId: string, feedback: ExplainerFeedback) => Promise<void>;
export type RecordUnderstandingResponse = (checkId: string, response: UnderstandingResponse) => Promise<void>;
export type DisputeUnderstandingEvaluation = (
  checkId: string,
  dispute: Omit<EvaluationDispute, "checkId">
) => Promise<void>;
export type RecordCheckPreference = (checkId: string, preference: Omit<CheckPreference, "checkId">) => Promise<void>;
export type EvidenceVectorIndex = ReadonlyMap<string, UnderstandingEvidenceVector>;
export type RecordMicroWorldPrediction = (
  artifactId: string,
  optionId: string,
  variableValues: MicroWorldVariableValues
) => Promise<void>;
export type RecordMicroWorldInteraction = (
  artifactId: string,
  variableValues: MicroWorldVariableValues
) => Promise<void>;
export type RecordMicroWorldReflection = (artifactId: string, prompt: string, response: string) => Promise<void>;
