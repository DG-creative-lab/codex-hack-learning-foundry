import { z } from "zod";
import type { EvidenceEvent } from "./types";

export const MICRO_WORLD_LIMITS = {
  idCharacters: 200,
  titleCharacters: 200,
  descriptionCharacters: 1600,
  scenarioCharacters: 2400,
  predictionCharacters: 1600,
  reflectionCharacters: 1600,
  variables: 8,
  controls: 8,
  outcomes: 8,
  predictionOptions: 5,
  assumptions: 8,
  limitations: 8,
  reflectionPrompts: 4,
  sourceIds: 64,
  fragmentIds: 128,
  theoryElementIds: 64
} as const;

const boundedIdSchema = z.string().min(1).max(MICRO_WORLD_LIMITS.idCharacters);
const boundedDescriptionSchema = z.string().trim().min(1).max(MICRO_WORLD_LIMITS.descriptionCharacters);
const boundedIds = (maximum: number) => z.array(boundedIdSchema).max(maximum);

export const microWorldVariableRoleSchema = z.enum(["spacing", "hierarchy", "information_density"]);
export const microWorldRendererSchema = z.enum(["design_density_queue"]);

export const microWorldVariableSchema = z
  .object({
    id: boundedIdSchema,
    role: microWorldVariableRoleSchema,
    label: z.string().min(1).max(MICRO_WORLD_LIMITS.titleCharacters),
    description: boundedDescriptionSchema,
    min: z.number().finite(),
    max: z.number().finite(),
    step: z.number().finite().positive(),
    initialValue: z.number().finite(),
    unit: z.enum(["px", "percent", "fields"])
  })
  .strict()
  .superRefine((variable, context) => {
    if (variable.max <= variable.min) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Variable maximum must exceed its minimum." });
    }
    if (variable.initialValue < variable.min || variable.initialValue > variable.max) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Variable initial value must fall within its range.",
        path: ["initialValue"]
      });
    }
    if (variable.step > variable.max - variable.min) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Variable step cannot exceed its range.",
        path: ["step"]
      });
    }
  });

export const microWorldControlSchema = z
  .object({
    id: boundedIdSchema,
    variableId: boundedIdSchema,
    kind: z.literal("range")
  })
  .strict();

export const microWorldOutcomeSchema = z
  .object({
    id: boundedIdSchema,
    kind: z.enum(["visible_capacity", "scan_effort", "hierarchy_clarity"]),
    label: z.string().min(1).max(MICRO_WORLD_LIMITS.titleCharacters),
    description: boundedDescriptionSchema,
    unit: z.enum(["items", "seconds", "percent"]),
    betterDirection: z.enum(["higher", "lower"]),
    sourceIds: boundedIds(MICRO_WORLD_LIMITS.sourceIds),
    theoryElementIds: boundedIds(MICRO_WORLD_LIMITS.theoryElementIds).min(1)
  })
  .strict();

const predictionOptionSchema = z
  .object({
    id: boundedIdSchema,
    label: z.string().min(1).max(MICRO_WORLD_LIMITS.titleCharacters)
  })
  .strict();

const predictionSchema = z
  .object({
    prompt: z.string().min(1).max(MICRO_WORLD_LIMITS.predictionCharacters),
    options: z.array(predictionOptionSchema).min(2).max(MICRO_WORLD_LIMITS.predictionOptions)
  })
  .strict();

function hasDuplicates(values: string[]): boolean {
  return new Set(values).size !== values.length;
}

export const microWorldArtifactSchema = z
  .object({
    id: boundedIdSchema,
    renderer: microWorldRendererSchema,
    title: z.string().min(1).max(MICRO_WORLD_LIMITS.titleCharacters),
    purpose: boundedDescriptionSchema,
    scenario: z.string().min(1).max(MICRO_WORLD_LIMITS.scenarioCharacters),
    sourceIds: boundedIds(MICRO_WORLD_LIMITS.sourceIds).min(1),
    fragmentIds: boundedIds(MICRO_WORLD_LIMITS.fragmentIds),
    theoryElementIds: boundedIds(MICRO_WORLD_LIMITS.theoryElementIds).min(1),
    variables: z.array(microWorldVariableSchema).min(3).max(MICRO_WORLD_LIMITS.variables),
    controls: z.array(microWorldControlSchema).min(3).max(MICRO_WORLD_LIMITS.controls),
    outcomes: z.array(microWorldOutcomeSchema).min(3).max(MICRO_WORLD_LIMITS.outcomes),
    prediction: predictionSchema,
    assumptions: z.array(boundedDescriptionSchema).min(1).max(MICRO_WORLD_LIMITS.assumptions),
    limitations: z.array(boundedDescriptionSchema).min(1).max(MICRO_WORLD_LIMITS.limitations),
    reflectionPrompts: z
      .array(z.string().min(1).max(MICRO_WORLD_LIMITS.reflectionCharacters))
      .min(1)
      .max(MICRO_WORLD_LIMITS.reflectionPrompts)
  })
  .strict()
  .superRefine((artifact, context) => {
    const variableIds = artifact.variables.map((variable) => variable.id);
    const variableRoles = artifact.variables.map((variable) => variable.role);
    const controlIds = artifact.controls.map((control) => control.id);
    const controlledVariableIds = artifact.controls.map((control) => control.variableId);
    const outcomeIds = artifact.outcomes.map((outcome) => outcome.id);
    const outcomeKinds = artifact.outcomes.map((outcome) => outcome.kind);
    const optionIds = artifact.prediction.options.map((option) => option.id);
    const artifactSourceIds = new Set(artifact.sourceIds);
    const artifactTheoryIds = new Set(artifact.theoryElementIds);

    if (hasDuplicates(variableIds))
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Variable IDs must be unique." });
    if (hasDuplicates(variableRoles))
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Variable roles must be unique." });
    if (hasDuplicates(controlIds))
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Control IDs must be unique." });
    if (hasDuplicates(controlledVariableIds)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Each variable can have only one control." });
    }
    if (hasDuplicates(outcomeIds))
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Outcome IDs must be unique." });
    if (hasDuplicates(outcomeKinds))
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Outcome kinds must be unique." });
    if (hasDuplicates(optionIds))
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Prediction option IDs must be unique." });
    if (hasDuplicates(artifact.sourceIds))
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Source IDs must be unique." });
    if (hasDuplicates(artifact.fragmentIds))
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Fragment IDs must be unique." });
    if (hasDuplicates(artifact.theoryElementIds)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Theory element IDs must be unique." });
    }

    const variableIdSet = new Set(variableIds);
    for (const [index, control] of artifact.controls.entries()) {
      if (!variableIdSet.has(control.variableId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Control references unknown variable ${control.variableId}.`,
          path: ["controls", index, "variableId"]
        });
      }
    }
    const uncontrolledVariableId = variableIds.find((id) => !controlledVariableIds.includes(id));
    if (uncontrolledVariableId) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: `Variable ${uncontrolledVariableId} has no control.` });
    }

    for (const [index, outcome] of artifact.outcomes.entries()) {
      const unknownSourceId = outcome.sourceIds.find((id) => !artifactSourceIds.has(id));
      const unknownTheoryId = outcome.theoryElementIds.find((id) => !artifactTheoryIds.has(id));
      if (unknownSourceId) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Outcome references undeclared source ${unknownSourceId}.`,
          path: ["outcomes", index, "sourceIds"]
        });
      }
      if (unknownTheoryId) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Outcome references undeclared theory element ${unknownTheoryId}.`,
          path: ["outcomes", index, "theoryElementIds"]
        });
      }
    }
  });

const variableValuesSchema = z.record(boundedIdSchema, z.number().finite());
const outcomeValuesSchema = z.record(boundedIdSchema, z.number().finite());

export const microWorldRegisteredPayloadSchema = z.object({ artifact: microWorldArtifactSchema }).strict();
export const microWorldPredictionPayloadSchema = z
  .object({ artifactId: boundedIdSchema, optionId: boundedIdSchema, variableValues: variableValuesSchema })
  .strict();
export const microWorldInteractionPayloadSchema = z
  .object({
    artifactId: boundedIdSchema,
    variableValues: variableValuesSchema,
    changedVariableIds: boundedIds(MICRO_WORLD_LIMITS.variables).min(1),
    outcomeValues: outcomeValuesSchema
  })
  .strict();
export const microWorldReflectionPayloadSchema = z
  .object({
    artifactId: boundedIdSchema,
    prompt: z.string().min(1).max(MICRO_WORLD_LIMITS.reflectionCharacters),
    response: z.string().trim().min(3).max(MICRO_WORLD_LIMITS.reflectionCharacters),
    interactionEventId: boundedIdSchema.optional()
  })
  .strict();

export type MicroWorldArtifact = z.infer<typeof microWorldArtifactSchema>;
export type MicroWorldPrediction = z.infer<typeof microWorldPredictionPayloadSchema>;
export type MicroWorldInteraction = z.infer<typeof microWorldInteractionPayloadSchema>;
export type MicroWorldReflection = z.infer<typeof microWorldReflectionPayloadSchema>;
export type MicroWorldVariableValues = z.infer<typeof variableValuesSchema>;
export type MicroWorldOutcomeValues = z.infer<typeof outcomeValuesSchema>;

export interface MicroWorldProjection extends MicroWorldArtifact {
  predictions: Array<MicroWorldPrediction & { evidenceEventId: string; createdAt: string }>;
  interactions: Array<MicroWorldInteraction & { evidenceEventId: string; createdAt: string }>;
  reflections: Array<MicroWorldReflection & { evidenceEventId: string; createdAt: string }>;
}

function normalizedValue(artifact: MicroWorldArtifact, values: MicroWorldVariableValues, role: string): number {
  const variable = artifact.variables.find((item) => item.role === role);
  if (!variable) throw new Error(`Micro-world ${artifact.id} is missing the ${role} variable`);
  const value = values[variable.id];
  if (value === undefined) throw new Error(`Micro-world values are missing ${variable.id}`);
  return (value - variable.min) / (variable.max - variable.min);
}

export function evaluateMicroWorld(
  artifact: MicroWorldArtifact,
  values: MicroWorldVariableValues
): MicroWorldOutcomeValues {
  validateVariableValues(artifact, values, `Micro-world ${artifact.id}`);
  if (artifact.renderer !== "design_density_queue") throw new Error(`Unsupported renderer ${artifact.renderer}`);
  const spacing = normalizedValue(artifact, values, "spacing");
  const hierarchy = normalizedValue(artifact, values, "hierarchy");
  const informationDensity = normalizedValue(artifact, values, "information_density");

  return Object.fromEntries(
    artifact.outcomes.map((outcome) => {
      if (outcome.kind === "visible_capacity") {
        return [outcome.id, Math.round(5 + informationDensity * 4 - spacing * 2)];
      }
      if (outcome.kind === "scan_effort") {
        const value = 5.2 + informationDensity * 3.4 + (1 - hierarchy) * 3.8 + Math.abs(spacing - 0.55) * 1.8;
        return [outcome.id, Number(value.toFixed(1))];
      }
      const value = 38 + hierarchy * 54 + spacing * 8 - informationDensity * 14;
      return [outcome.id, Math.round(Math.max(0, Math.min(100, value)))];
    })
  );
}

interface MicroWorldContext {
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

function validateVariableValues(artifact: MicroWorldArtifact, values: MicroWorldVariableValues, entity: string) {
  const valueIds = Object.keys(values);
  const variableIds = artifact.variables.map((variable) => variable.id);
  const unknownId = valueIds.find((id) => !variableIds.includes(id));
  const missingId = variableIds.find((id) => !(id in values));
  if (unknownId) throw new Error(`${entity} references unknown variable ${unknownId}`);
  if (missingId) throw new Error(`${entity} is missing variable ${missingId}`);
  for (const variable of artifact.variables) {
    const value = values[variable.id];
    if (value === undefined || value < variable.min || value > variable.max) {
      throw new Error(`${entity} value for ${variable.id} falls outside its declared range`);
    }
    const stepOffset = (value - variable.min) / variable.step;
    if (Math.abs(stepOffset - Math.round(stepOffset)) > 1e-8) {
      throw new Error(`${entity} value for ${variable.id} does not align with its declared step`);
    }
  }
}

function validateOutcomeValues(artifact: MicroWorldArtifact, values: MicroWorldOutcomeValues, entity: string) {
  const valueIds = Object.keys(values);
  const outcomeIds = artifact.outcomes.map((outcome) => outcome.id);
  const unknownId = valueIds.find((id) => !outcomeIds.includes(id));
  const missingId = outcomeIds.find((id) => !(id in values));
  if (unknownId) throw new Error(`${entity} references unknown outcome ${unknownId}`);
  if (missingId) throw new Error(`${entity} is missing outcome ${missingId}`);
}

export function deriveMicroWorlds(events: EvidenceEvent[], context: MicroWorldContext): MicroWorldProjection[] {
  const worlds = new Map<string, MicroWorldProjection>();

  for (const event of events) {
    if (event.type === "learning.micro_world_registered") {
      if (event.actor !== "agent" || event.kind !== "agent_synthesis") {
        throw new Error(`Micro-world event ${event.id} must be recorded as agent synthesis`);
      }
      const { artifact } = microWorldRegisteredPayloadSchema.parse(event.payload);
      if (worlds.has(artifact.id)) throw new Error(`Micro-world artifact ID ${artifact.id} is duplicated`);
      requireKnownIds(`Micro-world ${artifact.id}`, artifact.sourceIds, context.sourceIds, "source");
      requireKnownIds(
        `Micro-world ${artifact.id}`,
        artifact.theoryElementIds,
        context.theoryElementIds,
        "theory element"
      );
      requireEventSources(event, `Micro-world ${artifact.id}`, artifact.sourceIds);
      for (const fragmentId of artifact.fragmentIds) {
        const fragment = context.fragments.get(fragmentId);
        if (!fragment) throw new Error(`Micro-world ${artifact.id} references unknown fragment ${fragmentId}`);
        if (!artifact.sourceIds.includes(fragment.sourceId)) {
          throw new Error(`Micro-world ${artifact.id} does not declare fragment source ${fragment.sourceId}`);
        }
      }
      worlds.set(artifact.id, { ...artifact, predictions: [], interactions: [], reflections: [] });
    }

    if (event.type === "learning.micro_world_prediction_recorded") {
      if (event.actor !== "human" || event.kind !== "hypothesis") {
        throw new Error(`Micro-world prediction ${event.id} must be recorded as a human hypothesis`);
      }
      const prediction = microWorldPredictionPayloadSchema.parse(event.payload);
      const artifact = worlds.get(prediction.artifactId);
      if (!artifact) throw new Error(`Cannot predict in unknown micro-world ${prediction.artifactId}`);
      if (!artifact.prediction.options.some((option) => option.id === prediction.optionId)) {
        throw new Error(`Micro-world prediction references unknown option ${prediction.optionId}`);
      }
      validateVariableValues(artifact, prediction.variableValues, `Micro-world prediction ${event.id}`);
      requireEventSources(event, `Micro-world prediction ${event.id}`, artifact.sourceIds);
      worlds.set(artifact.id, {
        ...artifact,
        predictions: [...artifact.predictions, { ...prediction, evidenceEventId: event.id, createdAt: event.createdAt }]
      });
    }

    if (event.type === "learning.micro_world_interaction_recorded") {
      if (event.actor !== "human" || event.kind !== "practical_observation") {
        throw new Error(`Micro-world interaction ${event.id} must be recorded as a human practical observation`);
      }
      const interaction = microWorldInteractionPayloadSchema.parse(event.payload);
      const artifact = worlds.get(interaction.artifactId);
      if (!artifact) throw new Error(`Cannot interact with unknown micro-world ${interaction.artifactId}`);
      if (artifact.predictions.length === 0) {
        throw new Error(`Micro-world ${artifact.id} requires a prediction before recording an interaction`);
      }
      validateVariableValues(artifact, interaction.variableValues, `Micro-world interaction ${event.id}`);
      validateOutcomeValues(artifact, interaction.outcomeValues, `Micro-world interaction ${event.id}`);
      const expectedOutcomeValues = evaluateMicroWorld(artifact, interaction.variableValues);
      const mismatchedOutcomeId = artifact.outcomes
        .map((outcome) => outcome.id)
        .find((id) => interaction.outcomeValues[id] !== expectedOutcomeValues[id]);
      if (mismatchedOutcomeId) {
        throw new Error(`Micro-world interaction ${event.id} has an invalid value for outcome ${mismatchedOutcomeId}`);
      }
      requireKnownIds(
        `Micro-world interaction ${event.id}`,
        interaction.changedVariableIds,
        new Set(artifact.variables.map((variable) => variable.id)),
        "variable"
      );
      const previousValues =
        artifact.interactions.at(-1)?.variableValues ??
        Object.fromEntries(artifact.variables.map((variable) => [variable.id, variable.initialValue]));
      const actualChanges = artifact.variables
        .filter((variable) => previousValues[variable.id] !== interaction.variableValues[variable.id])
        .map((variable) => variable.id);
      if (actualChanges.length === 0)
        throw new Error(`Micro-world interaction ${event.id} records no changed variables`);
      const omittedChange = actualChanges.find((id) => !interaction.changedVariableIds.includes(id));
      const falseChange = interaction.changedVariableIds.find((id) => !actualChanges.includes(id));
      if (omittedChange || falseChange) {
        throw new Error(`Micro-world interaction ${event.id} changed-variable manifest is inconsistent`);
      }
      requireEventSources(event, `Micro-world interaction ${event.id}`, artifact.sourceIds);
      worlds.set(artifact.id, {
        ...artifact,
        interactions: [
          ...artifact.interactions,
          { ...interaction, evidenceEventId: event.id, createdAt: event.createdAt }
        ]
      });
    }

    if (event.type === "learning.micro_world_reflection_recorded") {
      if (event.actor !== "human" || event.kind !== "user_interpretation") {
        throw new Error(`Micro-world reflection ${event.id} must be recorded as a human interpretation`);
      }
      const reflection = microWorldReflectionPayloadSchema.parse(event.payload);
      const artifact = worlds.get(reflection.artifactId);
      if (!artifact) throw new Error(`Cannot reflect on unknown micro-world ${reflection.artifactId}`);
      if (artifact.interactions.length === 0) {
        throw new Error(`Micro-world ${artifact.id} requires an interaction before recording a reflection`);
      }
      if (!artifact.reflectionPrompts.includes(reflection.prompt)) {
        throw new Error(`Micro-world reflection references an unknown prompt`);
      }
      if (
        reflection.interactionEventId &&
        !artifact.interactions.some((interaction) => interaction.evidenceEventId === reflection.interactionEventId)
      ) {
        throw new Error(`Micro-world reflection references unknown interaction ${reflection.interactionEventId}`);
      }
      requireEventSources(event, `Micro-world reflection ${event.id}`, artifact.sourceIds);
      worlds.set(artifact.id, {
        ...artifact,
        reflections: [...artifact.reflections, { ...reflection, evidenceEventId: event.id, createdAt: event.createdAt }]
      });
    }
  }

  return [...worlds.values()];
}

export function countMicroWorldEvidence(worlds: MicroWorldProjection[]): number {
  return worlds.reduce(
    (total, world) => total + world.predictions.length + world.interactions.length + world.reflections.length,
    0
  );
}
