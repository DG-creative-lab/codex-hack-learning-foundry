// @vitest-environment happy-dom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import App from "./App";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
let container: HTMLDivElement | undefined;

beforeEach(() => {
  window.foundryMemory = {
    load: async () => ({ events: [], rejectedCount: 0 }),
    append: async () => true,
    reset: async () => true
  };
});

afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  container?.remove();
  delete window.foundryMemory;
  root = undefined;
  container = undefined;
});

function requiredElement<T extends Element>(parent: ParentNode, selector: string): T {
  const element = parent.querySelector<T>(selector);
  if (!element) throw new Error(`Expected element ${selector}`);
  return element;
}

describe("App understanding-gap intervention routing", () => {
  it("opens the exact prepared prediction check from its Memory signal", async () => {
    const view = document.createElement("div");
    container = view;
    document.body.append(view);
    root = createRoot(view);
    await act(async () => root?.render(<App />));

    await act(async () => requiredElement<HTMLButtonElement>(view, 'button[aria-label="Memory"]').click());
    expect(view.textContent).toContain("Shared memory");

    const predictionSignal = [...view.querySelectorAll<HTMLButtonElement>(".gap-register button")].find((button) =>
      button.textContent?.includes("Prediction evidence")
    );
    if (!predictionSignal) throw new Error("Prepared prediction signal is missing");
    await act(async () => predictionSignal.click());
    await act(async () => requiredElement<HTMLButtonElement>(view, ".gap-intervention button").click());

    expect(view.textContent).toContain("Learning studio");
    const selectedJourneyItem = requiredElement<HTMLButtonElement>(view, ".artifact-list button.selected");
    expect(selectedJourneyItem.textContent).toContain("Prediction");
    expect(requiredElement(view, ".understanding-check-preview").textContent).toContain("Predict what would happen");
  });
});
