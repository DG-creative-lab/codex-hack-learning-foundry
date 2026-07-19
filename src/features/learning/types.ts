import type { ExplainerFeedback } from "../../domain/explainer";
import type { NormalizedSourceFragment } from "../../domain/sourcePipeline";
import type { SourceRecord } from "../../domain/workspaceEntities";

export type FragmentIndex = ReadonlyMap<string, NormalizedSourceFragment>;
export type SourceIndex = ReadonlyMap<string, SourceRecord>;
export type RecordExplainerFeedback = (artifactId: string, feedback: ExplainerFeedback) => Promise<void>;
