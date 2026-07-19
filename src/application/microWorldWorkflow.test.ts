import { describe, expect, it } from "vitest";
import { preparedDensityMicroWorld, seedEvents } from "../data/sample";
import { deriveMicroWorlds, type MicroWorldProjection } from "../domain/microWorld";
import type { EvidenceEvent } from "../domain/types";
import { reduceWorkspace } from "../domain/workspaceProjection";
import { createLearningWorkflow } from "./learningWorkflow";

describe("micro-world learning workflow", () => {
  it("resolves the canonical world and records a grounded prediction, interaction, and reflection", async () => {
    const workspace = reduceWorkspace(seedEvents);
    const registration = seedEvents.find((event) => event.type === "learning.micro_world_registered");
    if (!registration) throw new Error("Prepared micro-world registration is missing");
    const context = {
      sourceIds: new Set(workspace.sources.map((source) => source.id)),
      fragments: new Map(workspace.sourceFragments.map((fragment) => [fragment.id, fragment])),
      theoryElementIds: new Set(workspace.theory.elements.map((element) => element.id))
    };
    const events: EvidenceEvent[] = [];
    let sequence = 0;
    const resolveMicroWorld = (artifactId: string): MicroWorldProjection | undefined =>
      deriveMicroWorlds([registration, ...events], context).find((world) => world.id === artifactId);
    const workflow = createLearningWorkflow({
      append: async (event) => {
        events.push(event);
      },
      resolveExplainer: () => undefined,
      resolveMicroWorld,
      resolveUnderstandingCheck: () => undefined,
      now: () => `2026-07-19T15:0${sequence}:00.000Z`,
      createId: (prefix) => `${prefix}-${++sequence}`
    });
    const initialValues = Object.fromEntries(
      preparedDensityMicroWorld.variables.map((variable) => [variable.id, variable.initialValue])
    );

    await workflow.recordMicroWorldPrediction(preparedDensityMicroWorld.id, "prediction-tradeoff", initialValues);
    await workflow.recordMicroWorldInteraction(preparedDensityMicroWorld.id, {
      ...initialValues,
      "queue-spacing": 10,
      "queue-information": 7
    });
    await workflow.recordMicroWorldReflection(
      preparedDensityMicroWorld.id,
      preparedDensityMicroWorld.reflectionPrompts[0],
      "The extra fields raised capacity, but stronger hierarchy was needed to preserve scanning."
    );

    expect(events.map((event) => event.type)).toEqual([
      "learning.micro_world_prediction_recorded",
      "learning.micro_world_interaction_recorded",
      "learning.micro_world_reflection_recorded"
    ]);
    expect(events.map((event) => event.kind)).toEqual(["hypothesis", "practical_observation", "user_interpretation"]);
    expect(events.every((event) => event.sourceIds.length === preparedDensityMicroWorld.sourceIds.length)).toBe(true);
    const projection = resolveMicroWorld(preparedDensityMicroWorld.id);
    expect(projection?.predictions).toHaveLength(1);
    expect(projection?.interactions).toHaveLength(1);
    expect(projection?.reflections[0]?.interactionEventId).toBe(events[1]?.id);
  });

  it("rejects observations before a prediction and unchanged configurations before append", async () => {
    const world = reduceWorkspace(seedEvents).microWorlds[0];
    if (!world) throw new Error("Prepared micro-world projection is missing");
    const events: EvidenceEvent[] = [];
    let canonicalWorld = world;
    const workflow = createLearningWorkflow({
      append: async (event) => events.push(event),
      resolveExplainer: () => undefined,
      resolveMicroWorld: (artifactId) => (artifactId === canonicalWorld.id ? canonicalWorld : undefined),
      resolveUnderstandingCheck: () => undefined
    });
    const values = Object.fromEntries(world.variables.map((variable) => [variable.id, variable.initialValue]));

    await expect(workflow.recordMicroWorldInteraction(world.id, values)).rejects.toThrow("requires a prediction");
    canonicalWorld = {
      ...world,
      predictions: [
        {
          artifactId: world.id,
          optionId: world.prediction.options[0]?.id ?? "",
          variableValues: values,
          evidenceEventId: "evt-existing-prediction",
          createdAt: "2026-07-19T15:00:00.000Z"
        }
      ]
    };
    await expect(workflow.recordMicroWorldInteraction(world.id, values)).rejects.toThrow("no changed variables");
    await expect(
      workflow.recordMicroWorldReflection(world.id, world.reflectionPrompts[0], "A premature reflection.")
    ).rejects.toThrow("requires an interaction");
    expect(events).toHaveLength(0);
  });
});
