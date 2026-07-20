import { z } from "zod";
import {
  type MicroWorldProjection,
  microWorldInteractionPayloadSchema,
  microWorldReflectionPayloadSchema
} from "./microWorld";
import type { EvidenceEvent } from "./types";

export const PRACTICAL_EVIDENCE_LIMITS = {
  idCharacters: 240,
  summaryCharacters: 2400,
  theoryElementIds: 64,
  records: 256
} as const;

const boundedIdSchema = z.string().min(1).max(PRACTICAL_EVIDENCE_LIMITS.idCharacters);
const uniqueIdsSchema = z
  .array(boundedIdSchema)
  .min(1)
  .max(PRACTICAL_EVIDENCE_LIMITS.theoryElementIds)
  .superRefine((ids, context) => {
    if (new Set(ids).size !== ids.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Practical evidence IDs must be unique." });
    }
  });
const boundedSummarySchema = z.string().trim().min(3).max(PRACTICAL_EVIDENCE_LIMITS.summaryCharacters);

export const practicalOutcomeSchema = z.enum(["successful", "partial", "failed"]);
export const practicalFeedbackKindSchema = z.enum(["observation", "correction", "failure", "participation"]);

export const practicalApplicationPayloadSchema = z
  .object({
    capabilityId: boundedIdSchema,
    capabilityVersion: z.string().min(1).max(80),
    inputSummary: boundedSummarySchema,
    outputSummary: boundedSummarySchema,
    outcome: practicalOutcomeSchema,
    theoryElementIds: uniqueIdsSchema
  })
  .strict();

export const practicalFeedbackPayloadSchema = z
  .object({
    subjectEventId: boundedIdSchema,
    capabilityId: boundedIdSchema.optional(),
    kind: practicalFeedbackKindSchema,
    content: boundedSummarySchema,
    theoryElementIds: uniqueIdsSchema
  })
  .strict();

const feedbackEventTypes = {
  observation: "practical.observation_recorded",
  correction: "practical.correction_recorded",
  failure: "practical.failure_recorded",
  participation: "practical.participation_recorded"
} as const;

const eligibleFeedbackSubjects = new Set([
  "practical.application_recorded",
  "learning.micro_world_interaction_recorded",
  "learning.micro_world_reflection_recorded"
]);

export type PracticalOutcome = z.infer<typeof practicalOutcomeSchema>;
export type PracticalFeedbackKind = z.infer<typeof practicalFeedbackKindSchema>;
export type PracticalApplication = z.infer<typeof practicalApplicationPayloadSchema> & {
  evidenceEventId: string;
  createdAt: string;
};
export type PracticalFeedback = z.infer<typeof practicalFeedbackPayloadSchema> & {
  evidenceEventId: string;
  createdAt: string;
};

export interface PracticalEvidenceProjection {
  applications: PracticalApplication[];
  feedback: PracticalFeedback[];
}

interface PracticalEvidenceContext {
  sourceIds: Set<string>;
  theoryElementIds: Set<string>;
  capabilityIds: Set<string>;
  microWorlds: Map<string, MicroWorldProjection>;
}

function requireKnownIds(entity: string, ids: string[], knownIds: Set<string>, kind: string) {
  const unknownId = ids.find((id) => !knownIds.has(id));
  if (unknownId) throw new Error(`${entity} references unknown ${kind} ${unknownId}`);
}

function subjectContext(subject: EvidenceEvent, context: PracticalEvidenceContext) {
  if (subject.type === "practical.application_recorded") {
    const application = practicalApplicationPayloadSchema.parse(subject.payload);
    return { capabilityId: application.capabilityId, theoryElementIds: application.theoryElementIds };
  }
  const artifactId =
    subject.type === "learning.micro_world_interaction_recorded"
      ? microWorldInteractionPayloadSchema.parse(subject.payload).artifactId
      : microWorldReflectionPayloadSchema.parse(subject.payload).artifactId;
  const world = context.microWorlds.get(artifactId);
  if (!world) throw new Error(`Practical feedback subject ${subject.id} references unknown micro-world ${artifactId}`);
  return { capabilityId: undefined, theoryElementIds: world.theoryElementIds };
}

export function derivePracticalEvidence(
  events: EvidenceEvent[],
  context: PracticalEvidenceContext
): PracticalEvidenceProjection {
  const applications: PracticalApplication[] = [];
  const feedback: PracticalFeedback[] = [];
  const eventsById = new Map<string, EvidenceEvent>();

  for (const event of events) {
    if (event.type === "practical.application_recorded") {
      if (event.actor !== "agent" || event.kind !== "practical_observation") {
        throw new Error(`Practical application ${event.id} must be recorded as an agent practical observation`);
      }
      const payload = practicalApplicationPayloadSchema.parse(event.payload);
      if (!context.capabilityIds.has(payload.capabilityId)) {
        throw new Error(`Practical application ${event.id} references unknown capability ${payload.capabilityId}`);
      }
      requireKnownIds(
        `Practical application ${event.id}`,
        payload.theoryElementIds,
        context.theoryElementIds,
        "theory element"
      );
      requireKnownIds(`Practical application ${event.id}`, event.sourceIds, context.sourceIds, "source");
      applications.push({ ...payload, evidenceEventId: event.id, createdAt: event.createdAt });
    }

    const feedbackKind = Object.entries(feedbackEventTypes).find(([, eventType]) => eventType === event.type)?.[0] as
      | PracticalFeedbackKind
      | undefined;
    if (feedbackKind) {
      const expectedEvidenceKind = feedbackKind === "correction" ? "user_interpretation" : "practical_observation";
      if (event.actor !== "human" || event.kind !== expectedEvidenceKind) {
        throw new Error(`Practical ${feedbackKind} ${event.id} has an invalid actor or evidence kind`);
      }
      const payload = practicalFeedbackPayloadSchema.parse(event.payload);
      if (payload.kind !== feedbackKind) {
        throw new Error(`Practical feedback ${event.id} does not match its event type`);
      }
      const subject = eventsById.get(payload.subjectEventId);
      if (!subject || !eligibleFeedbackSubjects.has(subject.type)) {
        throw new Error(`Practical feedback ${event.id} references an ineligible subject ${payload.subjectEventId}`);
      }
      if (payload.capabilityId && !context.capabilityIds.has(payload.capabilityId)) {
        throw new Error(`Practical feedback ${event.id} references unknown capability ${payload.capabilityId}`);
      }
      const expected = subjectContext(subject, context);
      if (payload.capabilityId !== expected.capabilityId) {
        throw new Error(`Practical feedback ${event.id} does not match its subject capability`);
      }
      if (!payload.theoryElementIds.every((theoryElementId) => expected.theoryElementIds.includes(theoryElementId))) {
        throw new Error(`Practical feedback ${event.id} does not match its subject theory context`);
      }
      requireKnownIds(
        `Practical feedback ${event.id}`,
        payload.theoryElementIds,
        context.theoryElementIds,
        "theory element"
      );
      requireKnownIds(`Practical feedback ${event.id}`, event.sourceIds, context.sourceIds, "source");
      const missingSubjectSource = subject.sourceIds.find((sourceId) => !event.sourceIds.includes(sourceId));
      if (missingSubjectSource) {
        throw new Error(`Practical feedback ${event.id} is missing subject provenance for ${missingSubjectSource}`);
      }
      feedback.push({ ...payload, evidenceEventId: event.id, createdAt: event.createdAt });
    }

    eventsById.set(event.id, event);
  }

  if (applications.length + feedback.length > PRACTICAL_EVIDENCE_LIMITS.records) {
    throw new Error("Practical evidence projection exceeds its bounded record limit");
  }
  return { applications, feedback };
}

export function practicalFeedbackEventType(kind: PracticalFeedbackKind) {
  return feedbackEventTypes[kind];
}
