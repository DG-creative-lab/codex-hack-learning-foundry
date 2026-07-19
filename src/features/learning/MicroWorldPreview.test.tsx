// @vitest-environment happy-dom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { preparedDensityMicroWorld } from "../../data/sample";
import type { MicroWorldProjection } from "../../domain/microWorld";
import { MicroWorldPreview } from "./MicroWorldPreview";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

interface Deferred {
  promise: Promise<void>;
  resolve: () => void;
}

function deferred(): Deferred {
  let resolve: () => void = () => {};
  const promise = new Promise<void>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

function projection(overrides: Partial<MicroWorldProjection> = {}): MicroWorldProjection {
  return {
    ...preparedDensityMicroWorld,
    predictions: [],
    interactions: [],
    reflections: [],
    ...overrides
  };
}

function requiredElement<T extends Element>(container: ParentNode, selector: string): T {
  const element = container.querySelector<T>(selector);
  if (!element) throw new Error(`Expected element ${selector}`);
  return element;
}

function initialValues() {
  return Object.fromEntries(
    preparedDensityMicroWorld.variables.map((variable) => [variable.id, variable.initialValue])
  );
}

let root: Root | undefined;
let container: HTMLDivElement | undefined;

afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
});

async function renderPreview(
  artifact: MicroWorldProjection,
  commands: {
    onPrediction?: () => Promise<void>;
    onInteraction?: () => Promise<void>;
  }
) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(
      <MicroWorldPreview
        artifact={artifact}
        sourcesById={new Map()}
        onPrediction={commands.onPrediction ?? (async () => undefined)}
        onInteraction={commands.onInteraction ?? (async () => undefined)}
        onReflection={async () => undefined}
      />
    );
  });
  return container;
}

function expectControlsDisabled(view: ParentNode, disabled: boolean) {
  expect(requiredElement<HTMLButtonElement>(view, 'button[title="Reset variables"]').disabled).toBe(disabled);
  for (const input of view.querySelectorAll<HTMLInputElement>('.micro-world-controls input[type="range"]')) {
    expect(input.disabled).toBe(disabled);
  }
}

describe("MicroWorldPreview pending commands", () => {
  it("freezes variables while prediction evidence is being appended", async () => {
    const append = deferred();
    const view = await renderPreview(projection(), { onPrediction: vi.fn(() => append.promise) });
    const reveal = requiredElement<HTMLButtonElement>(view, ".prediction-panel .primary-button");

    await act(async () => reveal.click());

    expectControlsDisabled(view, true);
    expect(requiredElement<HTMLFieldSetElement>(view, ".prediction-panel fieldset").disabled).toBe(true);

    await act(async () => append.resolve());

    expectControlsDisabled(view, false);
    expect(view.textContent).toContain("Prediction recorded");
  });

  it("freezes variables while interaction evidence is being appended", async () => {
    const append = deferred();
    const values = initialValues();
    const artifact = projection({
      predictions: [
        {
          artifactId: preparedDensityMicroWorld.id,
          optionId: preparedDensityMicroWorld.prediction.options[0]?.id ?? "",
          variableValues: values,
          evidenceEventId: "evt-existing-prediction",
          createdAt: "2026-07-19T15:00:00.000Z"
        }
      ]
    });
    const view = await renderPreview(artifact, { onInteraction: vi.fn(() => append.promise) });
    const spacing = requiredElement<HTMLInputElement>(view, 'input[aria-label="Row spacing"]');
    await act(async () => {
      spacing.value = "10";
      spacing.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const record = requiredElement<HTMLButtonElement>(view, ".micro-world-record");
    expect(record.disabled).toBe(false);

    await act(async () => record.click());

    expectControlsDisabled(view, true);

    await act(async () => append.resolve());

    expectControlsDisabled(view, false);
    expect(view.textContent).toContain("Interaction recorded");
  });
});
