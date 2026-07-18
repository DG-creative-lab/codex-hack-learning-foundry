import { describe, expect, it } from "vitest";
import { deriveLivingTheory } from "./livingTheory";
import {
  createSynthesisProposal,
  type ExtractedSourceDocument,
  normalizedSourceFragmentSchema,
  normalizeExtractedDocument,
  proposalReviewEvent
} from "./sourcePipeline";
import { deriveSourcePipeline } from "./sourceProjection";
import type { EvidenceEvent } from "./types";

const extractedAt = "2026-07-18T18:00:00.000Z";

function document(kind: "text" | "web", fingerprint: string, content: string): ExtractedSourceDocument {
  return {
    title: kind === "text" ? "Local notes" : "Online article",
    author: "Test author",
    format: kind === "text" ? "Text" : "Web page",
    fingerprint,
    units: [
      {
        content,
        location:
          kind === "text"
            ? { kind: "text", label: "Lines 1-2", lineStart: 1, lineEnd: 2 }
            : { kind: "web", label: "Block 1", url: "https://example.com/article" }
      }
    ]
  };
}

function sourceEvent(): EvidenceEvent {
  return {
    id: "evt-source-runtime",
    type: "source.registered",
    kind: "source_fact",
    actor: "system",
    createdAt: extractedAt,
    summary: "Registered test source.",
    sourceIds: ["source-runtime"],
    payload: {
      source: {
        id: "source-runtime",
        title: "Test source",
        author: "Pending extraction",
        origin: "local",
        format: "Local file",
        status: "queued",
        progress: 0,
        addedAt: "Just now",
        provenance: "/tmp/source.txt",
        outputs: { atoms: 0, lessons: 0, capabilities: 0 }
      }
    }
  };
}

describe("universal source pipeline", () => {
  it("normalizes local and online units through the same fragment contract", () => {
    const local = normalizeExtractedDocument(
      "source-local",
      document("text", "a".repeat(64), "Density is contextual."),
      extractedAt
    );
    const online = normalizeExtractedDocument(
      "source-web",
      document("web", "b".repeat(64), "Density is contextual."),
      extractedAt
    );

    expect(normalizedSourceFragmentSchema.parse(local.fragments[0]).content).toBe("Density is contextual.");
    expect(normalizedSourceFragmentSchema.parse(online.fragments[0]).content).toBe("Density is contextual.");
    expect(Object.keys(local.fragments[0] ?? {}).sort()).toEqual(Object.keys(online.fragments[0] ?? {}).sort());
  });

  it("retains fragment-level context on proposed and approved theory elements", () => {
    const normalized = normalizeExtractedDocument(
      "source-runtime",
      document("text", "c".repeat(64), "A useful interface is evaluated for a named user."),
      extractedAt
    );
    const proposal = createSynthesisProposal(
      "source-runtime",
      normalized.version,
      normalized.fragments,
      "proposal-1",
      extractedAt
    );
    const event = proposalReviewEvent(proposal, "approved", extractedAt);
    const element = Array.isArray(event.payload.elements) ? event.payload.elements[0] : undefined;

    expect(event.type).toBe("theory.synthesis_reviewed");
    expect(proposal.elements[0]?.element.fragmentIds).toEqual([normalized.fragments[0]?.id]);
    expect(element).toMatchObject({ sourceIds: ["source-runtime"], fragmentIds: [normalized.fragments[0]?.id] });
    expect(normalized.fragments[0]?.location).toMatchObject({ label: "Lines 1-2", lineStart: 1, lineEnd: 2 });
    const theory = deriveLivingTheory([event], {
      id: "theory-atomic-approval",
      title: "Atomic approval",
      sourceIds: ["source-runtime"]
    });
    expect(theory.elements[0]).toMatchObject({
      id: proposal.elements[0]?.element.id,
      evidenceEventIds: [event.id]
    });
  });

  it("marks unsupported and conflicting synthesis for review", () => {
    const normalized = normalizeExtractedDocument(
      "source-runtime",
      {
        ...document("text", "d".repeat(64), "This claim may be useful."),
        units: [
          { content: "This recommendation is likely correct.", location: { kind: "text", label: "Line 1" } },
          {
            content: "However, it conflicts with the prior recommendation.",
            location: { kind: "text", label: "Line 2" }
          }
        ]
      },
      extractedAt
    );
    const proposal = createSynthesisProposal(
      "source-runtime",
      normalized.version,
      normalized.fragments,
      "proposal-review",
      extractedAt
    );

    expect(proposal.elements.map((candidate) => candidate.support)).toEqual(["uncertain", "conflicting"]);
    expect(proposal.relationships[0]).toMatchObject({ support: "conflicting", relationship: { kind: "contradicts" } });
  });

  it("creates a new source version and theory revision when content changes", () => {
    const first = normalizeExtractedDocument(
      "source-runtime",
      document("text", "e".repeat(64), "Density is contextual."),
      extractedAt
    );
    const firstProposal = {
      ...createSynthesisProposal("source-runtime", first.version, first.fragments, "proposal-v1", extractedAt),
      status: "approved" as const
    };
    const second = normalizeExtractedDocument(
      "source-runtime",
      document("text", "f".repeat(64), "Density is contextual to expertise."),
      "2026-07-18T19:00:00.000Z",
      first.version.id
    );
    const secondProposal = createSynthesisProposal(
      "source-runtime",
      second.version,
      second.fragments,
      "proposal-v2",
      "2026-07-18T19:00:00.000Z",
      firstProposal
    );

    expect(second.version.id).not.toBe(first.version.id);
    expect(second.version.previousVersionId).toBe(first.version.id);
    expect(secondProposal.elements[0]?.element).toMatchObject({
      id: "proposal-v2-element-1",
      revisesElementId: "proposal-v1-element-1"
    });
    const approval = proposalReviewEvent(secondProposal, "approved", extractedAt);
    expect(approval.payload).toMatchObject({
      decision: "approved",
      elements: [{ revisesElementId: "proposal-v1-element-1" }]
    });
  });

  it("projects recoverable extraction failures explicitly", () => {
    const failed: EvidenceEvent = {
      id: "evt-source-failed",
      type: "source.processing_failed",
      kind: "practical_observation",
      actor: "system",
      createdAt: extractedAt,
      summary: "Extraction failed.",
      sourceIds: ["source-runtime"],
      payload: {
        sourceId: "source-runtime",
        error: { code: "fetch_failed", message: "Temporary failure.", retryable: true }
      }
    };

    expect(deriveSourcePipeline([sourceEvent(), failed]).sources[0]).toMatchObject({
      status: "failed",
      error: { code: "fetch_failed", retryable: true }
    });
  });

  it("records rejection without producing canonical theory events", () => {
    const normalized = normalizeExtractedDocument(
      "source-runtime",
      document("text", "9".repeat(64), "This claim needs review."),
      extractedAt
    );
    const proposal = createSynthesisProposal(
      "source-runtime",
      normalized.version,
      normalized.fragments,
      "proposal-rejected",
      extractedAt
    );
    const event = proposalReviewEvent(proposal, "rejected", extractedAt);

    expect(event).toMatchObject({
      type: "theory.synthesis_reviewed",
      payload: { proposalId: proposal.id, decision: "rejected" }
    });
    expect(event.type).not.toMatch(/^theory\.(element|relationship)_/);
  });

  it("projects extraction and its proposal from one durable event", () => {
    const normalized = normalizeExtractedDocument(
      "source-runtime",
      document("text", "8".repeat(64), "Density is contextual."),
      extractedAt
    );
    const proposal = createSynthesisProposal(
      "source-runtime",
      normalized.version,
      normalized.fragments,
      "proposal-atomic",
      extractedAt
    );
    const synthesis: EvidenceEvent = {
      id: "evt-source-synthesis-atomic",
      type: "source.synthesis_completed",
      kind: "agent_synthesis",
      actor: "agent",
      createdAt: extractedAt,
      summary: "Extracted and synthesized source.",
      sourceIds: ["source-runtime"],
      payload: {
        sourceId: "source-runtime",
        author: "Test author",
        outputs: { atoms: 1, lessons: 0, capabilities: 0 },
        version: normalized.version,
        fragments: normalized.fragments,
        proposal
      }
    };

    const projection = deriveSourcePipeline([sourceEvent(), synthesis]);
    expect(projection.sources[0]).toMatchObject({ status: "review", currentVersionId: normalized.version.id });
    expect(projection.proposals).toEqual([proposal]);
  });

  it("rejects a versioned extraction without its synthesis proposal", () => {
    const normalized = normalizeExtractedDocument(
      "source-runtime",
      document("text", "5".repeat(64), "Density is contextual."),
      extractedAt
    );
    const incomplete: EvidenceEvent = {
      id: "evt-source-extraction-incomplete",
      type: "source.processing_completed",
      kind: "practical_observation",
      actor: "system",
      createdAt: extractedAt,
      summary: "Extracted without synthesis.",
      sourceIds: ["source-runtime"],
      payload: {
        sourceId: "source-runtime",
        author: "Test author",
        outputs: { atoms: 1, lessons: 0, capabilities: 0 },
        version: normalized.version,
        fragments: normalized.fragments
      }
    };

    expect(() => deriveSourcePipeline([sourceEvent(), incomplete])).toThrow();
  });

  it("only permits pending proposals to be reviewed", () => {
    const normalized = normalizeExtractedDocument(
      "source-runtime",
      document("text", "7".repeat(64), "Density is contextual."),
      extractedAt
    );
    const proposal = createSynthesisProposal(
      "source-runtime",
      normalized.version,
      normalized.fragments,
      "proposal-once",
      extractedAt
    );
    const synthesis: EvidenceEvent = {
      id: "evt-source-synthesis-once",
      type: "source.synthesis_completed",
      kind: "agent_synthesis",
      actor: "agent",
      createdAt: extractedAt,
      summary: "Extracted and synthesized source.",
      sourceIds: ["source-runtime"],
      payload: {
        sourceId: "source-runtime",
        author: "Test author",
        outputs: { atoms: 1, lessons: 0, capabilities: 0 },
        version: normalized.version,
        fragments: normalized.fragments,
        proposal
      }
    };
    const approved = proposalReviewEvent(proposal, "approved", extractedAt);
    const rejected = { ...proposalReviewEvent(proposal, "rejected", extractedAt), id: "evt-proposal-rejected-later" };

    expect(() => deriveSourcePipeline([sourceEvent(), synthesis, approved, rejected])).toThrow(
      "cannot transition from approved to rejected"
    );
  });

  it("rejects an approval payload that differs from its pending proposal", () => {
    const normalized = normalizeExtractedDocument(
      "source-runtime",
      document("text", "6".repeat(64), "Density is contextual."),
      extractedAt
    );
    const proposal = createSynthesisProposal(
      "source-runtime",
      normalized.version,
      normalized.fragments,
      "proposal-tampered",
      extractedAt
    );
    const synthesis: EvidenceEvent = {
      id: "evt-source-synthesis-tampered",
      type: "source.synthesis_completed",
      kind: "agent_synthesis",
      actor: "agent",
      createdAt: extractedAt,
      summary: "Extracted and synthesized source.",
      sourceIds: ["source-runtime"],
      payload: {
        sourceId: "source-runtime",
        author: "Test author",
        outputs: { atoms: 1, lessons: 0, capabilities: 0 },
        version: normalized.version,
        fragments: normalized.fragments,
        proposal
      }
    };
    const approval = proposalReviewEvent(proposal, "approved", extractedAt);
    const elements = structuredClone(approval.payload.elements) as Array<Record<string, unknown>>;
    if (elements[0]) elements[0].statement = "A different statement.";
    approval.payload = { ...approval.payload, elements };

    expect(() => deriveSourcePipeline([sourceEvent(), synthesis, approval])).toThrow(
      "does not match proposal proposal-tampered"
    );
  });
});
