import { describe, expect, it } from "vitest";
import { preparedDensityMicroWorld, seedEvents } from "../data/sample";
import {
  deriveMicroWorlds,
  evaluateMicroWorld,
  type MicroWorldVariableValues,
  microWorldArtifactSchema
} from "./microWorld";
import { getMicroWorldRendererDefinition } from "./microWorldRendererRegistry";
import type { EvidenceEvent } from "./types";
import { reduceWorkspace } from "./workspaceProjection";

function fixture() {
  const workspace = reduceWorkspace(seedEvents);
  const registration = seedEvents.find((event) => event.type === "learning.micro_world_registered");
  if (!registration) throw new Error("Prepared micro-world registration is missing");
  const context = {
    sourceIds: new Set(workspace.sources.map((source) => source.id)),
    fragments: new Map(workspace.sourceFragments.map((fragment) => [fragment.id, fragment])),
    theoryElementIds: new Set(workspace.theory.elements.map((element) => element.id))
  };
  const values = Object.fromEntries(
    preparedDensityMicroWorld.variables.map((variable) => [variable.id, variable.initialValue])
  );
  return { registration, context, values };
}

function prediction(values: MicroWorldVariableValues): EvidenceEvent {
  return {
    id: "evt-test-micro-world-prediction",
    type: "learning.micro_world_prediction_recorded",
    kind: "hypothesis",
    createdAt: "2026-07-19T15:00:00.000Z",
    actor: "human",
    summary: "Predicted a density trade-off.",
    sourceIds: preparedDensityMicroWorld.sourceIds,
    payload: {
      artifactId: preparedDensityMicroWorld.id,
      optionId: "prediction-tradeoff",
      variableValues: values
    }
  };
}

describe("micro-world artifacts", () => {
  it("defines a bounded trusted renderer with three controlled variables and grounded outcomes", () => {
    expect(preparedDensityMicroWorld.renderer).toBe("design_density_queue");
    expect(preparedDensityMicroWorld.variables.map((variable) => variable.role)).toEqual([
      "spacing",
      "hierarchy",
      "information_density"
    ]);
    expect(preparedDensityMicroWorld.controls).toHaveLength(3);
    expect(preparedDensityMicroWorld.outcomes).toHaveLength(3);
    expect(preparedDensityMicroWorld.outcomes.every((outcome) => outcome.theoryElementIds.length > 0)).toBe(true);
    expect(getMicroWorldRendererDefinition(preparedDensityMicroWorld.renderer)).toMatchObject({
      variableRoles: ["spacing", "hierarchy", "information_density"],
      outcomeKinds: ["visible_capacity", "scan_effort", "hierarchy_clarity"]
    });
    expect(() =>
      microWorldArtifactSchema.parse({ ...preparedDensityMicroWorld, renderer: "generated_javascript" })
    ).toThrow();
    expect(() =>
      microWorldArtifactSchema.parse({
        ...preparedDensityMicroWorld,
        limitations: ["x".repeat(2000)]
      })
    ).toThrow();
    expect(() =>
      microWorldArtifactSchema.parse({
        ...preparedDensityMicroWorld,
        variables: preparedDensityMicroWorld.variables.map((variable, index) =>
          index === 0 ? { ...variable, initialValue: variable.min + variable.step / 2 } : variable
        )
      })
    ).toThrow("initial value must align");
    expect(() =>
      microWorldArtifactSchema.parse({
        ...preparedDensityMicroWorld,
        prediction: {
          ...preparedDensityMicroWorld.prediction,
          options: preparedDensityMicroWorld.prediction.options.map((option, index) =>
            index === 0
              ? { ...option, expectedChanges: [{ outcomeId: "unknown-outcome", direction: "increase" }] }
              : option
          )
        }
      })
    ).toThrow("unknown outcome");
  });

  it("replays prediction, interaction, and reflection as separate immutable evidence", () => {
    const { registration, context, values } = fixture();
    const changedValues = { ...values, "queue-spacing": 10, "queue-information": 7 };
    const outcomes = evaluateMicroWorld(preparedDensityMicroWorld, changedValues);
    const interaction: EvidenceEvent = {
      id: "evt-test-micro-world-interaction",
      type: "learning.micro_world_interaction_recorded",
      kind: "practical_observation",
      createdAt: "2026-07-19T15:01:00.000Z",
      actor: "human",
      summary: "Changed the queue configuration.",
      sourceIds: preparedDensityMicroWorld.sourceIds,
      payload: {
        artifactId: preparedDensityMicroWorld.id,
        variableValues: changedValues,
        changedVariableIds: ["queue-spacing", "queue-information"],
        outcomeValues: outcomes
      }
    };
    const reflection: EvidenceEvent = {
      id: "evt-test-micro-world-reflection",
      type: "learning.micro_world_reflection_recorded",
      kind: "user_interpretation",
      createdAt: "2026-07-19T15:02:00.000Z",
      actor: "human",
      summary: "Reflected on the observed trade-off.",
      sourceIds: preparedDensityMicroWorld.sourceIds,
      payload: {
        artifactId: preparedDensityMicroWorld.id,
        prompt: preparedDensityMicroWorld.reflectionPrompts[0],
        response: "Capacity improved, but hierarchy needed reinforcement.",
        interactionEventId: interaction.id
      }
    };

    const projected = deriveMicroWorlds([registration, prediction(values), interaction, reflection], context)[0];

    expect(projected?.predictions).toHaveLength(1);
    expect(projected?.interactions[0]?.outcomeValues).toEqual(outcomes);
    expect(projected?.reflections[0]?.interactionEventId).toBe(interaction.id);

    const missingLinkReflection = {
      ...reflection,
      id: "evt-test-reflection-missing-link",
      payload: {
        artifactId: preparedDensityMicroWorld.id,
        prompt: preparedDensityMicroWorld.reflectionPrompts[0],
        response: "This reflection does not identify its observation."
      }
    };
    expect(() =>
      deriveMicroWorlds([registration, prediction(values), interaction, missingLinkReflection], context)
    ).toThrow();

    const unknownLinkReflection = {
      ...reflection,
      id: "evt-test-reflection-unknown-link",
      payload: { ...reflection.payload, interactionEventId: "evt-missing-interaction" }
    };
    expect(() =>
      deriveMicroWorlds([registration, prediction(values), interaction, unknownLinkReflection], context)
    ).toThrow("unknown interaction");
  });

  it("requires a prediction before interaction evidence", () => {
    const { registration, context, values } = fixture();
    const changedValues = { ...values, "queue-hierarchy": 80 };
    const interaction: EvidenceEvent = {
      id: "evt-test-interaction-without-prediction",
      type: "learning.micro_world_interaction_recorded",
      kind: "practical_observation",
      createdAt: "2026-07-19T15:01:00.000Z",
      actor: "human",
      summary: "Changed hierarchy without predicting.",
      sourceIds: preparedDensityMicroWorld.sourceIds,
      payload: {
        artifactId: preparedDensityMicroWorld.id,
        variableValues: changedValues,
        changedVariableIds: ["queue-hierarchy"],
        outcomeValues: evaluateMicroWorld(preparedDensityMicroWorld, changedValues)
      }
    };

    expect(() => deriveMicroWorlds([registration, interaction], context)).toThrow("requires a prediction");
  });

  it("rejects incomplete snapshots, inconsistent change manifests, and missing provenance", () => {
    const { registration, context, values } = fixture();
    const incompletePrediction = prediction({ ...values });
    const incompleteValues = { ...values };
    delete incompleteValues["queue-spacing"];
    incompletePrediction.payload = { ...incompletePrediction.payload, variableValues: incompleteValues };
    expect(() => deriveMicroWorlds([registration, incompletePrediction], context)).toThrow("missing variable");

    const missingProvenance = { ...prediction(values), sourceIds: [preparedDensityMicroWorld.sourceIds[0]] };
    expect(() => deriveMicroWorlds([registration, missingProvenance], context)).toThrow("missing provenance");

    const changedValues = { ...values, "queue-hierarchy": 80 };
    const inconsistentInteraction: EvidenceEvent = {
      id: "evt-test-inconsistent-interaction",
      type: "learning.micro_world_interaction_recorded",
      kind: "practical_observation",
      createdAt: "2026-07-19T15:01:00.000Z",
      actor: "human",
      summary: "Recorded the wrong changed variable.",
      sourceIds: preparedDensityMicroWorld.sourceIds,
      payload: {
        artifactId: preparedDensityMicroWorld.id,
        variableValues: changedValues,
        changedVariableIds: ["queue-spacing"],
        outcomeValues: evaluateMicroWorld(preparedDensityMicroWorld, changedValues)
      }
    };
    expect(() => deriveMicroWorlds([registration, prediction(values), inconsistentInteraction], context)).toThrow(
      "changed-variable manifest is inconsistent"
    );

    const forgedOutcomeInteraction = {
      ...inconsistentInteraction,
      id: "evt-test-forged-outcome",
      payload: {
        ...inconsistentInteraction.payload,
        changedVariableIds: ["queue-hierarchy"],
        outcomeValues: {
          ...evaluateMicroWorld(preparedDensityMicroWorld, changedValues),
          "outcome-hierarchy-clarity": 100
        }
      }
    };
    expect(() => deriveMicroWorlds([registration, prediction(values), forgedOutcomeInteraction], context)).toThrow(
      "invalid value for outcome"
    );
  });
});
