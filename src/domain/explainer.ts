import { z } from "zod";
import type { EvidenceEvent } from "./types";
import { evidenceKindSchema } from "./types";

export const explainerSectionKindSchema = z.enum([
  "background",
  "purpose",
  "intuition",
  "mechanism",
  "details",
  "assumptions"
]);

const sectionOrder = explainerSectionKindSchema.options;

export const explainerSectionSchema = z
  .object({
    id: z.string().min(1),
    kind: explainerSectionKindSchema,
    title: z.string().min(1),
    content: z.string().min(1),
    epistemicKind: evidenceKindSchema,
    sourceIds: z.array(z.string().min(1)),
    fragmentIds: z.array(z.string().min(1)),
    theoryElementIds: z.array(z.string().min(1))
  })
  .strict()
  .superRefine((section, context) => {
    if (section.epistemicKind === "source_fact" && section.fragmentIds.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Source-fact explainer sections must reference at least one source fragment.",
        path: ["fragmentIds"]
      });
    }
    if (section.fragmentIds.length > 0 && section.sourceIds.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Fragment-grounded explainer sections must identify their sources.",
        path: ["sourceIds"]
      });
    }
  });

export const understandingCheckSeedSchema = z
  .object({
    id: z.string().min(1),
    prompt: z.string().min(1),
    sectionIds: z.array(z.string().min(1)).min(1)
  })
  .strict();

export const microWorldSeedSchema = z
  .object({
    title: z.string().min(1),
    scenario: z.string().min(1),
    variables: z
      .array(
        z
          .object({
            id: z.string().min(1),
            label: z.string().min(1),
            lowLabel: z.string().min(1),
            highLabel: z.string().min(1),
            initialValue: z.number().min(0).max(100)
          })
          .strict()
      )
      .min(1)
  })
  .strict();

function hasDuplicates(values: string[]): boolean {
  return new Set(values).size !== values.length;
}

export const explainerArtifactSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    objective: z.string().min(1),
    projectContext: z.string().min(1),
    sourceIds: z.array(z.string().min(1)).min(1),
    theoryElementIds: z.array(z.string().min(1)),
    sections: z.array(explainerSectionSchema),
    understandingCheckSeeds: z.array(understandingCheckSeedSchema).min(1),
    microWorldSeed: microWorldSeedSchema
  })
  .strict()
  .superRefine((artifact, context) => {
    const kinds = artifact.sections.map((section) => section.kind);
    if (kinds.join("|") !== sectionOrder.join("|")) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Explainer sections must follow the narrative order: ${sectionOrder.join(", ")}.`,
        path: ["sections"]
      });
    }
    if (hasDuplicates(artifact.sections.map((section) => section.id))) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Explainer section IDs must be unique.",
        path: ["sections"]
      });
    }
    if (hasDuplicates(artifact.sourceIds)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Explainer source IDs must be unique.",
        path: ["sourceIds"]
      });
    }
    const sectionIds = new Set(artifact.sections.map((section) => section.id));
    for (const [index, seed] of artifact.understandingCheckSeeds.entries()) {
      const unknownSectionId = seed.sectionIds.find((sectionId) => !sectionIds.has(sectionId));
      if (unknownSectionId) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Understanding check references unknown section ${unknownSectionId}.`,
          path: ["understandingCheckSeeds", index, "sectionIds"]
        });
      }
    }
    const artifactSourceIds = new Set(artifact.sourceIds);
    for (const [index, section] of artifact.sections.entries()) {
      const unknownSourceId = section.sourceIds.find((sourceId) => !artifactSourceIds.has(sourceId));
      if (unknownSourceId) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Explainer section references undeclared source ${unknownSourceId}.`,
          path: ["sections", index, "sourceIds"]
        });
      }
    }
  });

export const explainerFeedbackSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("confusion"), sectionId: z.string().min(1) }).strict(),
  z
    .object({
      kind: z.literal("correction"),
      sectionId: z.string().min(1),
      correction: z.string().trim().min(3).max(1200)
    })
    .strict(),
  z.object({ kind: z.literal("depth"), depth: z.enum(["less", "more"]) }).strict()
]);

const registeredPayloadSchema = z.object({ artifact: explainerArtifactSchema }).strict();
export const explainerFeedbackPayloadSchema = z
  .object({ artifactId: z.string().min(1), feedback: explainerFeedbackSchema })
  .strict();

export type ExplainerArtifact = z.infer<typeof explainerArtifactSchema>;
export type ExplainerFeedback = z.infer<typeof explainerFeedbackSchema>;
export type ExplainerSection = z.infer<typeof explainerSectionSchema>;

export type ExplainerFeedbackRecord = ExplainerFeedback & { evidenceEventId: string; createdAt: string };

export interface ExplainerProjection extends ExplainerArtifact {
  feedback: ExplainerFeedbackRecord[];
}

interface ExplainerContext {
  sourceIds: Set<string>;
  fragments: Map<string, { sourceId: string }>;
  theoryElementIds: Set<string>;
}

function requireKnownIds(entity: string, ids: string[], knownIds: Set<string>, kind: string) {
  const unknownId = ids.find((id) => !knownIds.has(id));
  if (unknownId) throw new Error(`${entity} references unknown ${kind} ${unknownId}`);
}

export function deriveExplainers(events: EvidenceEvent[], context: ExplainerContext): ExplainerProjection[] {
  const explainers = new Map<string, ExplainerProjection>();

  for (const event of events) {
    if (event.type === "learning.explainer_registered") {
      if (event.actor !== "agent" || event.kind !== "agent_synthesis") {
        throw new Error(`Explainer event ${event.id} must be recorded as agent synthesis`);
      }
      const { artifact } = registeredPayloadSchema.parse(event.payload);
      if (explainers.has(artifact.id)) throw new Error(`Explainer artifact ID ${artifact.id} is duplicated`);
      requireKnownIds(`Explainer ${artifact.id}`, artifact.sourceIds, context.sourceIds, "source");
      requireKnownIds(
        `Explainer ${artifact.id}`,
        artifact.theoryElementIds,
        context.theoryElementIds,
        "theory element"
      );
      const missingEnvelopeSource = artifact.sourceIds.find((sourceId) => !event.sourceIds.includes(sourceId));
      if (missingEnvelopeSource) {
        throw new Error(`Explainer event ${event.id} is missing provenance for ${missingEnvelopeSource}`);
      }

      for (const section of artifact.sections) {
        requireKnownIds(
          `Explainer section ${section.id}`,
          section.theoryElementIds,
          context.theoryElementIds,
          "theory element"
        );
        for (const fragmentId of section.fragmentIds) {
          const fragment = context.fragments.get(fragmentId);
          if (!fragment) throw new Error(`Explainer section ${section.id} references unknown fragment ${fragmentId}`);
          if (!section.sourceIds.includes(fragment.sourceId)) {
            throw new Error(`Explainer section ${section.id} does not declare fragment source ${fragment.sourceId}`);
          }
        }
      }
      explainers.set(artifact.id, { ...artifact, feedback: [] });
    }

    if (event.type === "learning.explainer_feedback_recorded") {
      if (event.actor !== "human" || event.kind !== "user_interpretation") {
        throw new Error(`Explainer feedback ${event.id} must be recorded as human interpretation`);
      }
      const { artifactId, feedback } = explainerFeedbackPayloadSchema.parse(event.payload);
      const artifact = explainers.get(artifactId);
      if (!artifact) throw new Error(`Cannot record feedback for unknown explainer ${artifactId}`);
      if ("sectionId" in feedback && !artifact.sections.some((section) => section.id === feedback.sectionId)) {
        throw new Error(`Explainer feedback references unknown section ${feedback.sectionId}`);
      }
      requireKnownIds(`Explainer feedback ${event.id}`, event.sourceIds, context.sourceIds, "source");
      const missingEnvelopeSource = artifact.sourceIds.find((sourceId) => !event.sourceIds.includes(sourceId));
      if (missingEnvelopeSource) {
        throw new Error(`Explainer feedback ${event.id} is missing provenance for ${missingEnvelopeSource}`);
      }
      explainers.set(artifactId, {
        ...artifact,
        feedback: [...artifact.feedback, { ...feedback, evidenceEventId: event.id, createdAt: event.createdAt }]
      });
    }
  }

  return [...explainers.values()];
}
