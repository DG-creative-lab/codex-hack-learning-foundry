import { z } from "zod";
import {
  EXECUTION_LIMITS,
  executionAdapterIdSchema,
  executionPromptBoundarySchema
} from "../../shared/execution-contract.js";
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

export const executionAttemptSchema = z
  .object({
    adapter: executionAdapterIdSchema,
    status: z.enum(["succeeded", "failed"]),
    startedAt: z.string().datetime(),
    completedAt: z.string().datetime(),
    durationMs: z.number().int().nonnegative().max(300000),
    adapterVersion: z.string().trim().min(1).max(120),
    error: z
      .object({
        code: z.string().trim().min(1).max(80),
        message: z.string().trim().min(1).max(EXECUTION_LIMITS.errorCharacters),
        recoverable: z.boolean()
      })
      .strict()
      .optional()
  })
  .strict()
  .superRefine((attempt, context) => {
    if ((attempt.status === "failed") !== Boolean(attempt.error)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Only failed execution attempts may carry an error.",
        path: ["error"]
      });
    }
  });

export const executionTraceSchema = z
  .object({
    requestedAdapter: executionAdapterIdSchema,
    completedAdapter: executionAdapterIdSchema,
    consent: z.enum(["not_required", "explicit"]),
    fallbackUsed: z.boolean(),
    promptBoundary: executionPromptBoundarySchema,
    inputProvenance: z
      .object({
        origin: z.literal("user_supplied"),
        sourceIds: uniqueIdsSchema,
        theoryElementIds: uniqueIdsSchema
      })
      .strict(),
    attempts: z.array(executionAttemptSchema).min(1).max(2)
  })
  .strict()
  .superRefine((trace, context) => {
    const first = trace.attempts[0];
    const final = trace.attempts.at(-1);
    if (!first || !final) return;
    if (first.adapter !== trace.requestedAdapter) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "The first attempt must use the requested adapter." });
    }
    if (final.status !== "succeeded" || final.adapter !== trace.completedAdapter) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "The completed adapter must identify the final success."
      });
    }
    const isFallback =
      trace.attempts.length === 2 &&
      first.adapter === "live_codex" &&
      first.status === "failed" &&
      final.adapter === "prepared" &&
      final.status === "succeeded";
    if (trace.fallbackUsed !== isFallback) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Fallback metadata does not match the attempt history."
      });
    }
    if (trace.requestedAdapter === "live_codex" && trace.consent !== "explicit") {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Live Codex execution requires explicit consent." });
    }
    if (trace.requestedAdapter === "prepared" && trace.consent !== "not_required") {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Prepared execution does not record live consent." });
    }
  });

export const practicalApplicationPayloadSchema = z
  .object({
    capabilityId: boundedIdSchema,
    capabilityVersion: z.string().min(1).max(80),
    inputSummary: boundedSummarySchema,
    outputSummary: boundedSummarySchema,
    outcome: practicalOutcomeSchema,
    theoryElementIds: uniqueIdsSchema,
    execution: executionTraceSchema
  })
  .strict();

const legacyPracticalApplicationPayloadSchema = z
  .object({
    capabilityId: boundedIdSchema,
    capabilityVersion: z.string().min(1).max(80),
    inputSummary: boundedSummarySchema,
    outputSummary: boundedSummarySchema,
    outcome: practicalOutcomeSchema,
    theoryElementIds: uniqueIdsSchema
  })
  .strict();

export function parsePracticalApplicationEvent(event: EvidenceEvent) {
  const current = practicalApplicationPayloadSchema.safeParse(event.payload);
  if (current.success) return current.data;
  const legacy = legacyPracticalApplicationPayloadSchema.parse(event.payload);
  return practicalApplicationPayloadSchema.parse({
    ...legacy,
    execution: {
      requestedAdapter: "prepared",
      completedAdapter: "prepared",
      consent: "not_required",
      fallbackUsed: false,
      promptBoundary: {
        instruction: "Project a legacy manually recorded capability application.",
        contextSections: [
          { label: "Capability", content: `${legacy.capabilityId} version ${legacy.capabilityVersion}` }
        ],
        excludedContext: ["No external execution context was recorded"]
      },
      inputProvenance: {
        origin: "user_supplied",
        sourceIds: event.sourceIds,
        theoryElementIds: legacy.theoryElementIds
      },
      attempts: [
        {
          adapter: "prepared",
          status: "succeeded",
          startedAt: event.createdAt,
          completedAt: event.createdAt,
          durationMs: 0,
          adapterVersion: "legacy-manual-v0"
        }
      ]
    }
  });
}

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
    const application = parsePracticalApplicationEvent(subject);
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
      const payload = parsePracticalApplicationEvent(event);
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
      if (
        event.sourceIds.length !== payload.execution.inputProvenance.sourceIds.length ||
        !event.sourceIds.every((sourceId) => payload.execution.inputProvenance.sourceIds.includes(sourceId))
      ) {
        throw new Error(`Practical application ${event.id} has inconsistent source provenance`);
      }
      if (
        payload.theoryElementIds.length !== payload.execution.inputProvenance.theoryElementIds.length ||
        !payload.theoryElementIds.every((id) => payload.execution.inputProvenance.theoryElementIds.includes(id))
      ) {
        throw new Error(`Practical application ${event.id} has inconsistent theory provenance`);
      }
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
