import { z } from "zod";
import { normalizeSourceUnits, SOURCE_CONTENT_LIMITS } from "../../shared/source-content.js";
import type { EvidenceEvent } from "./types";
import {
  type TheoryElementKind,
  type TheoryRelationshipKind,
  theoryElementPayloadSchema,
  theoryRelationshipSchema
} from "./types";

export const sourceLocationSchema = z
  .object({
    kind: z.enum(["text", "pdf", "web", "transcript"]),
    label: z.string().min(1),
    lineStart: z.number().int().positive().optional(),
    lineEnd: z.number().int().positive().optional(),
    page: z.number().int().positive().optional(),
    url: z.string().url().optional()
  })
  .strict();

export const extractedSourceUnitSchema = z
  .object({ content: z.string().min(1).max(SOURCE_CONTENT_LIMITS.maxUnitCharacters), location: sourceLocationSchema })
  .strict();

export const extractedSourceDocumentSchema = z
  .object({
    title: z.string().min(1),
    author: z.string().min(1),
    format: z.string().min(1),
    fingerprint: z.string().min(8),
    units: z.array(extractedSourceUnitSchema).min(1).max(SOURCE_CONTENT_LIMITS.maxUnits)
  })
  .strict();

export const normalizedSourceFragmentSchema = z
  .object({
    id: z.string().min(1),
    sourceId: z.string().min(1),
    versionId: z.string().min(1),
    ordinal: z.number().int().nonnegative(),
    content: z.string().min(1),
    location: sourceLocationSchema
  })
  .strict();

export const sourceVersionSchema = z
  .object({
    id: z.string().min(1),
    sourceId: z.string().min(1),
    fingerprint: z.string().min(8),
    previousVersionId: z.string().min(1).optional(),
    extractedAt: z.string().datetime(),
    fragmentIds: z.array(z.string().min(1)).min(1)
  })
  .strict();

export const synthesisSupportSchema = z.enum(["supported", "uncertain", "conflicting"]);

export const synthesisElementCandidateSchema = z
  .object({
    id: z.string().min(1),
    stableKey: z.string().min(1),
    confidence: z.number().min(0).max(1),
    support: synthesisSupportSchema,
    reviewReason: z.string().min(1).optional(),
    element: theoryElementPayloadSchema
  })
  .strict();

export const synthesisRelationshipCandidateSchema = z
  .object({
    id: z.string().min(1),
    confidence: z.number().min(0).max(1),
    support: synthesisSupportSchema,
    reviewReason: z.string().min(1).optional(),
    relationship: theoryRelationshipSchema
  })
  .strict();

export const sourceSynthesisProposalSchema = z
  .object({
    id: z.string().min(1),
    sourceId: z.string().min(1),
    versionId: z.string().min(1),
    status: z.enum(["pending", "approved", "rejected"]),
    createdAt: z.string().datetime(),
    elements: z.array(synthesisElementCandidateSchema),
    relationships: z.array(synthesisRelationshipCandidateSchema)
  })
  .strict()
  .superRefine((proposal, context) => {
    for (const [index, candidate] of proposal.elements.entries()) {
      if (!candidate.element.sourceIds.includes(proposal.sourceId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Synthesis elements must reference their proposal source.",
          path: ["elements", index, "element", "sourceIds"]
        });
      }
      if (candidate.element.fragmentIds.length === 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Synthesis elements must retain fragment provenance.",
          path: ["elements", index, "element", "fragmentIds"]
        });
      }
    }
    for (const [index, candidate] of proposal.relationships.entries()) {
      if (!candidate.relationship.sourceIds.includes(proposal.sourceId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Synthesis relationships must reference their proposal source.",
          path: ["relationships", index, "relationship", "sourceIds"]
        });
      }
      if (candidate.relationship.fragmentIds.length === 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Synthesis relationships must retain fragment provenance.",
          path: ["relationships", index, "relationship", "fragmentIds"]
        });
      }
    }
  });

export const sourceExtractionErrorSchema = z
  .object({ code: z.string().min(1), message: z.string().min(1), retryable: z.boolean() })
  .strict();

export const synthesisReviewPayloadSchema = z.discriminatedUnion("decision", [
  z
    .object({
      proposalId: z.string().min(1),
      decision: z.literal("approved"),
      elements: z.array(theoryElementPayloadSchema),
      relationships: z.array(theoryRelationshipSchema)
    })
    .strict(),
  z.object({ proposalId: z.string().min(1), decision: z.literal("rejected") }).strict()
]);

export type ExtractedSourceDocument = z.infer<typeof extractedSourceDocumentSchema>;
export type NormalizedSourceFragment = z.infer<typeof normalizedSourceFragmentSchema>;
export type SourceVersion = z.infer<typeof sourceVersionSchema>;
export type SourceSynthesisProposal = z.infer<typeof sourceSynthesisProposalSchema>;
export type SourceExtractionError = z.infer<typeof sourceExtractionErrorSchema>;

export function normalizeExtractedDocument(
  sourceId: string,
  document: ExtractedSourceDocument,
  extractedAt: string,
  previousVersionId?: string
): { version: SourceVersion; fragments: NormalizedSourceFragment[] } {
  const parsed = extractedSourceDocumentSchema.parse({
    ...document,
    units: normalizeSourceUnits(document.units)
  });
  const versionId = `${sourceId}-v-${parsed.fingerprint.slice(0, 12)}`;
  const fragments = parsed.units.map((unit, ordinal) =>
    normalizedSourceFragmentSchema.parse({
      id: `${versionId}-fragment-${String(ordinal + 1).padStart(3, "0")}`,
      sourceId,
      versionId,
      ordinal,
      content: unit.content.trim(),
      location: unit.location
    })
  );
  return {
    version: sourceVersionSchema.parse({
      id: versionId,
      sourceId,
      fingerprint: parsed.fingerprint,
      previousVersionId: previousVersionId === versionId ? undefined : previousVersionId,
      extractedAt,
      fragmentIds: fragments.map((fragment) => fragment.id)
    }),
    fragments
  };
}

function classify(content: string): {
  kind: TheoryElementKind;
  confidence: number;
  support: "supported" | "uncertain" | "conflicting";
  reviewReason?: string;
} {
  const text = content.toLowerCase();
  if (content.trim().endsWith("?"))
    return { kind: "question", confidence: 0.72, support: "uncertain", reviewReason: "Open question" };
  if (/\b(contradicts?|conflicts?|however|but)\b/.test(text))
    return { kind: "contradiction", confidence: 0.7, support: "conflicting", reviewReason: "Possible conflict" };
  if (/\b(assume|assumption|likely|presume)\b/.test(text))
    return { kind: "assumption", confidence: 0.68, support: "uncertain", reviewReason: "Assumption requires review" };
  if (/\b(decided|decision|we will|we chose)\b/.test(text))
    return { kind: "decision", confidence: 0.86, support: "supported" };
  if (/\b(must|must not|constraint|bounded by|only when)\b/.test(text))
    return { kind: "boundary", confidence: 0.84, support: "supported" };
  if (/\b(because|therefore|leads to|results in|causes?)\b/.test(text))
    return { kind: "causal_model", confidence: 0.8, support: "supported" };
  if (/\b(is|means|refers to|defined as)\b/.test(text))
    return { kind: "concept", confidence: 0.82, support: "supported" };
  return { kind: "claim", confidence: 0.64, support: "uncertain", reviewReason: "Claim has no explicit qualifier" };
}

function titleFor(content: string): string {
  const sentence = content.split(/[.!?]/, 1)[0]?.trim() || content.trim();
  const words = sentence.split(/\s+/).slice(0, 8).join(" ");
  return words.length < sentence.length ? `${words}...` : words;
}

export function createSynthesisProposal(
  sourceId: string,
  version: SourceVersion,
  fragments: NormalizedSourceFragment[],
  proposalId: string,
  createdAt: string,
  previousApproved?: SourceSynthesisProposal
): SourceSynthesisProposal {
  const priorByKey = new Map(previousApproved?.elements.map((candidate) => [candidate.stableKey, candidate]));
  const elements = fragments.map((fragment) => {
    const classification = classify(fragment.content);
    const stableKey = `fragment-${fragment.ordinal}`;
    const prior = priorByKey.get(stableKey);
    return {
      id: `${proposalId}-candidate-${fragment.ordinal + 1}`,
      stableKey,
      confidence: classification.confidence,
      support: classification.support,
      reviewReason: classification.reviewReason,
      element: {
        id: `${proposalId}-element-${fragment.ordinal + 1}`,
        kind: classification.kind,
        title: titleFor(fragment.content),
        statement: fragment.content,
        epistemicKind: "source_fact" as const,
        status: classification.support === "supported" ? ("active" as const) : ("unresolved" as const),
        sourceIds: [sourceId],
        fragmentIds: [fragment.id],
        evidenceEventIds: [],
        ...(prior ? { revisesElementId: prior.element.id } : {})
      }
    };
  });

  const relationships = elements.flatMap((candidate, index) => {
    if (index === 0) return [];
    const text = candidate.element.statement.toLowerCase();
    let kind: TheoryRelationshipKind | undefined;
    if (/\b(contradicts?|conflicts?|however|but)\b/.test(text)) kind = "contradicts";
    else if (/\b(because|supports?|therefore)\b/.test(text)) kind = "supports";
    if (!kind) return [];
    const prior = elements[index - 1];
    if (!prior) return [];
    const support = kind === "contradicts" ? ("conflicting" as const) : ("uncertain" as const);
    return [
      {
        id: `${proposalId}-relationship-candidate-${index}`,
        confidence: kind === "contradicts" ? 0.7 : 0.74,
        support,
        reviewReason: kind === "contradicts" ? "Conflict requires human resolution" : "Inferred discourse link",
        relationship: {
          id: `${proposalId}-relationship-${index}`,
          kind,
          fromElementId: candidate.element.id,
          toElementId: prior.element.id,
          sourceIds: [sourceId],
          fragmentIds: [...candidate.element.fragmentIds, ...prior.element.fragmentIds],
          evidenceEventIds: []
        }
      }
    ];
  });

  return sourceSynthesisProposalSchema.parse({
    id: proposalId,
    sourceId,
    versionId: version.id,
    status: "pending",
    createdAt,
    elements,
    relationships
  });
}

export function proposalReviewEvent(
  proposal: SourceSynthesisProposal,
  decision: "approved" | "rejected",
  createdAt: string
): EvidenceEvent {
  const parsed = sourceSynthesisProposalSchema.parse(proposal);
  if (parsed.status !== "pending") throw new Error(`Synthesis proposal ${parsed.id} has already been reviewed.`);
  const payload =
    decision === "approved"
      ? {
          proposalId: parsed.id,
          decision,
          elements: parsed.elements.map((candidate) => candidate.element),
          relationships: parsed.relationships.map((candidate) => candidate.relationship)
        }
      : { proposalId: parsed.id, decision };
  return {
    id: `evt-${parsed.id}-${decision}`,
    type: "theory.synthesis_reviewed",
    kind: "user_interpretation",
    actor: "human",
    createdAt,
    summary: `${decision === "approved" ? "Approved" : "Rejected"} synthesis proposal ${parsed.id}.`,
    sourceIds: [parsed.sourceId],
    payload: synthesisReviewPayloadSchema.parse(payload)
  };
}
