import { createSynthesisProposal, normalizeExtractedDocument, proposalReviewEvent } from "../domain/sourcePipeline";
import type { SourceRecord } from "../domain/sourceProjection";
import type { EvidenceEvent, EvidenceKind } from "../domain/types";
import type { WorkspaceProjection } from "../domain/workspaceProjection";
import { extractSource, type SourceExtractionResult } from "../services/sourceExtraction";

export type SourceInputMode = "local" | "url";

interface SourceWorkflowDependencies {
  append: (event: EvidenceEvent) => Promise<unknown>;
  extract?: (request: { origin: "local" | "web"; provenance: string }) => Promise<SourceExtractionResult>;
  now?: () => string;
  createId?: (prefix: string) => string;
}

function defaultId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function event(
  createId: (prefix: string) => string,
  createdAt: string,
  type: string,
  kind: EvidenceKind,
  actor: EvidenceEvent["actor"],
  summary: string,
  sourceIds: string[],
  payload: Record<string, unknown>
): EvidenceEvent {
  return { id: createId("evt"), type, kind, actor, createdAt, summary, sourceIds, payload };
}

function sourceTitle(mode: SourceInputMode, input: string): string {
  if (mode === "local") return input.split("/").pop() || "Local source";
  try {
    return new URL(input).hostname;
  } catch {
    return input;
  }
}

export function createSourceWorkflow(dependencies: SourceWorkflowDependencies) {
  const extract = dependencies.extract ?? extractSource;
  const now = dependencies.now ?? (() => new Date().toISOString());
  const createId = dependencies.createId ?? defaultId;

  async function register(mode: SourceInputMode, rawInput: string): Promise<string | undefined> {
    const input = rawInput.trim();
    if (!input) return undefined;
    const createdAt = now();
    const id = createId("source");
    const title = sourceTitle(mode, input);
    const source: SourceRecord = {
      id,
      title,
      author: "Pending extraction",
      origin: mode === "local" ? "local" : "web",
      format: mode === "local" ? "Local file" : "Web page",
      status: "queued",
      progress: 0,
      addedAt: "Just now",
      provenance: input,
      outputs: { atoms: 0, lessons: 0, capabilities: 0 }
    };
    await dependencies.append(
      event(
        createId,
        createdAt,
        "source.registered",
        "source_fact",
        "system",
        `Captured ${title}; extraction is queued.`,
        [id],
        {
          source
        }
      )
    );
    return id;
  }

  async function process(source: SourceRecord, workspace: WorkspaceProjection): Promise<void> {
    if (source.status === "processing") return;
    const createdAt = now();
    await dependencies.append(
      event(
        createId,
        createdAt,
        "source.processing_started",
        "practical_observation",
        "system",
        `Extraction and provenance capture started for ${source.title}.`,
        [source.id],
        { sourceId: source.id, progress: 18 }
      )
    );

    const result = await extract({
      origin: source.origin === "web" ? "web" : "local",
      provenance: source.provenance
    });
    if (!result.ok) {
      await dependencies.append(
        event(
          createId,
          createdAt,
          "source.processing_failed",
          "practical_observation",
          "system",
          result.error.message,
          [source.id],
          { sourceId: source.id, error: result.error }
        )
      );
      return;
    }

    const normalized = normalizeExtractedDocument(source.id, result.document, createdAt, source.currentVersionId);
    if (normalized.version.id === source.currentVersionId) {
      await dependencies.append(
        event(
          createId,
          createdAt,
          "source.processing_completed",
          "practical_observation",
          "system",
          `${source.title} is unchanged.`,
          [source.id],
          {
            sourceId: source.id,
            author: result.document.author,
            title: result.document.title,
            format: result.document.format,
            outputs: source.outputs
          }
        )
      );
      return;
    }

    const previousApproved = workspace.synthesisProposals.find(
      (proposal) => proposal.sourceId === source.id && proposal.status === "approved"
    );
    const proposal = createSynthesisProposal(
      source.id,
      normalized.version,
      normalized.fragments,
      createId(`synthesis-${source.id}`),
      createdAt,
      previousApproved
    );
    await dependencies.append(
      event(
        createId,
        createdAt,
        "source.synthesis_completed",
        "agent_synthesis",
        "agent",
        `Extracted ${normalized.fragments.length} fragments and proposed ${proposal.elements.length} theory elements for review.`,
        [source.id],
        {
          sourceId: source.id,
          author: result.document.author,
          title: result.document.title,
          format: result.document.format,
          outputs: { ...source.outputs, atoms: proposal.elements.length },
          version: normalized.version,
          fragments: normalized.fragments,
          proposal
        }
      )
    );
  }

  async function review(
    proposalId: string,
    decision: "approved" | "rejected",
    workspace: WorkspaceProjection
  ): Promise<void> {
    const proposal = workspace.synthesisProposals.find((candidate) => candidate.id === proposalId);
    if (proposal?.status !== "pending") return;
    await dependencies.append(proposalReviewEvent(proposal, decision, now()));
  }

  return { register, process, review };
}

export type SourceWorkflow = ReturnType<typeof createSourceWorkflow>;
