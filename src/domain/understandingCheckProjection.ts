import type { EvidenceEvent } from "./types";
import {
  checkPreferencePayloadSchema,
  type DimensionEvidence,
  evaluationDisputePayloadSchema,
  type ProjectedReviewItem,
  type UnderstandingCheckProjection,
  type UnderstandingChecksProjection,
  type UnderstandingDimension,
  type UnderstandingEvidenceVector,
  understandingAttemptPayloadSchema,
  understandingCheckRegisteredPayloadSchema,
  understandingDimensionSchema
} from "./understandingChecks";

interface UnderstandingCheckContext {
  sourceIds: Set<string>;
  fragments: Map<string, { sourceId: string }>;
  theoryElementIds: Set<string>;
}

function requireKnownIds(entity: string, ids: string[], knownIds: Set<string>, kind: string) {
  const unknownId = ids.find((id) => !knownIds.has(id));
  if (unknownId) throw new Error(`${entity} references unknown ${kind} ${unknownId}`);
}

function requireEventSources(event: EvidenceEvent, entity: string, sourceIds: string[]) {
  const missingSourceId = sourceIds.find((sourceId) => !event.sourceIds.includes(sourceId));
  if (missingSourceId) throw new Error(`${entity} event ${event.id} is missing provenance for ${missingSourceId}`);
}

function validateFragmentSources(
  entity: string,
  fragmentIds: string[],
  declaredSourceIds: string[],
  context: UnderstandingCheckContext
) {
  for (const fragmentId of fragmentIds) {
    const fragment = context.fragments.get(fragmentId);
    if (!fragment) throw new Error(`${entity} references unknown fragment ${fragmentId}`);
    if (!declaredSourceIds.includes(fragment.sourceId)) {
      throw new Error(`${entity} does not declare fragment source ${fragment.sourceId}`);
    }
  }
}

function emptyDimensions(): Record<UnderstandingDimension, DimensionEvidence> {
  return Object.fromEntries(
    understandingDimensionSchema.options.map((dimension) => [dimension, { supports: 0, mixed: 0, challenges: 0 }])
  ) as Record<UnderstandingDimension, DimensionEvidence>;
}

function buildEvidenceProjection(checks: UnderstandingCheckProjection[]) {
  const vectors = new Map<string, UnderstandingEvidenceVector>();
  const reviewItems: ProjectedReviewItem[] = [];

  for (const check of checks) {
    for (const attempt of check.attempts) {
      if (attempt.dispute) continue;
      for (const signal of attempt.evaluation.signals) {
        for (const theoryElementId of signal.theoryElementIds) {
          const vector = vectors.get(theoryElementId) ?? { theoryElementId, dimensions: emptyDimensions() };
          const dimension = vector.dimensions[signal.dimension];
          dimension[signal.signal] += 1;
          dimension.lastObservedAt = attempt.createdAt;
          vectors.set(theoryElementId, vector);
        }
      }
      for (const item of attempt.evaluation.reviewItems) {
        reviewItems.push({ ...item, checkId: check.id, attemptEventId: attempt.eventId });
      }
    }
  }

  return { evidenceVectors: [...vectors.values()], reviewItems };
}

export function deriveUnderstandingChecks(
  events: EvidenceEvent[],
  context: UnderstandingCheckContext
): UnderstandingChecksProjection {
  const checks = new Map<string, UnderstandingCheckProjection>();
  const prompts = new Set<string>();
  const cues = new Set<string>();

  for (const event of events) {
    if (event.type === "learning.understanding_check_registered") {
      if (event.actor !== "agent" || event.kind !== "agent_synthesis") {
        throw new Error(`Understanding check event ${event.id} must be recorded as agent synthesis`);
      }
      const { check } = understandingCheckRegisteredPayloadSchema.parse(event.payload);
      if (checks.has(check.id)) throw new Error(`Understanding check ID ${check.id} is duplicated`);
      const normalizedPrompt = check.prompt.trim().toLocaleLowerCase();
      const cueKey = `${check.cue.family}:${check.cue.variant}`;
      if (prompts.has(normalizedPrompt)) throw new Error(`Understanding check prompt is duplicated: ${check.prompt}`);
      if (cues.has(cueKey)) throw new Error(`Understanding check cue ${cueKey} is duplicated`);
      requireKnownIds(`Understanding check ${check.id}`, check.sourceIds, context.sourceIds, "source");
      requireKnownIds(
        `Understanding check ${check.id}`,
        check.theoryElementIds,
        context.theoryElementIds,
        "theory element"
      );
      validateFragmentSources(`Understanding check ${check.id}`, check.fragmentIds, check.sourceIds, context);
      requireEventSources(event, `Understanding check ${check.id}`, check.sourceIds);
      checks.set(check.id, { ...check, status: "ready", attempts: [] });
      prompts.add(normalizedPrompt);
      cues.add(cueKey);
    }

    if (event.type === "learning.understanding_attempt_recorded") {
      if (event.actor !== "human" || event.kind !== "practical_observation") {
        throw new Error(`Understanding attempt ${event.id} must be recorded as a human practical observation`);
      }
      const payload = understandingAttemptPayloadSchema.parse(event.payload);
      const check = checks.get(payload.checkId);
      if (!check) throw new Error(`Cannot record an attempt for unknown check ${payload.checkId}`);
      if (check.status === "rejected") throw new Error(`Cannot record an attempt for rejected check ${check.id}`);
      const citedSourceIds = payload.response.sourceSupport.sourceIds;
      requireKnownIds(`Understanding attempt ${event.id}`, citedSourceIds, context.sourceIds, "source");
      validateFragmentSources(
        `Understanding attempt ${event.id}`,
        payload.response.sourceSupport.fragmentIds,
        citedSourceIds,
        context
      );
      requireEventSources(event, `Understanding attempt ${event.id}`, [...check.sourceIds, ...citedSourceIds]);
      for (const signal of payload.evaluation.signals) {
        requireKnownIds(
          `Understanding evaluation ${event.id}`,
          signal.theoryElementIds,
          new Set(check.theoryElementIds),
          "check theory element"
        );
      }
      for (const item of payload.evaluation.reviewItems) {
        requireKnownIds(`Review item ${item.id}`, item.sourceIds, context.sourceIds, "source");
        requireKnownIds(
          `Review item ${item.id}`,
          item.theoryElementIds,
          new Set(check.theoryElementIds),
          "check theory element"
        );
        validateFragmentSources(`Review item ${item.id}`, item.fragmentIds, item.sourceIds, context);
      }
      checks.set(check.id, {
        ...check,
        attempts: [
          ...check.attempts,
          { eventId: event.id, createdAt: event.createdAt, response: payload.response, evaluation: payload.evaluation }
        ]
      });
    }

    if (event.type === "learning.understanding_evaluation_disputed") {
      if (event.actor !== "human" || event.kind !== "user_interpretation") {
        throw new Error(`Evaluation dispute ${event.id} must be recorded as a human interpretation`);
      }
      const dispute = evaluationDisputePayloadSchema.parse(event.payload);
      const check = checks.get(dispute.checkId);
      if (!check) throw new Error(`Cannot dispute an evaluation for unknown check ${dispute.checkId}`);
      const attemptIndex = check.attempts.findIndex((attempt) => attempt.eventId === dispute.attemptEventId);
      if (attemptIndex < 0) throw new Error(`Cannot dispute unknown attempt ${dispute.attemptEventId}`);
      if (check.attempts[attemptIndex]?.dispute) {
        throw new Error(`Attempt ${dispute.attemptEventId} is already disputed`);
      }
      requireEventSources(event, `Evaluation dispute ${event.id}`, check.sourceIds);
      const attempts = [...check.attempts];
      attempts[attemptIndex] = {
        ...attempts[attemptIndex],
        dispute: { ...dispute, evidenceEventId: event.id, createdAt: event.createdAt }
      };
      checks.set(check.id, { ...check, attempts });
    }

    if (event.type === "learning.understanding_check_preference_recorded") {
      if (event.actor !== "human" || event.kind !== "user_interpretation") {
        throw new Error(`Check preference ${event.id} must be recorded as a human interpretation`);
      }
      const preference = checkPreferencePayloadSchema.parse(event.payload);
      const check = checks.get(preference.checkId);
      if (!check) throw new Error(`Cannot steer unknown check ${preference.checkId}`);
      if (check.status === "rejected") throw new Error(`Check ${check.id} has already been rejected`);
      requireEventSources(event, `Check preference ${event.id}`, check.sourceIds);
      checks.set(check.id, {
        ...check,
        status: preference.preference === "reject" ? "rejected" : "ready",
        preference: { ...preference, evidenceEventId: event.id, createdAt: event.createdAt }
      });
    }
  }

  const projectedChecks = [...checks.values()];
  return { checks: projectedChecks, ...buildEvidenceProjection(projectedChecks) };
}
