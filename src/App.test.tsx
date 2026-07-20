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

function setTextareaValue(textarea: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  setter?.call(textarea, value);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("App understanding-gap intervention routing", () => {
  it("opens the exact prepared prediction check from its Memory signal", async () => {
    const view = document.createElement("div");
    container = view;
    document.body.append(view);
    root = createRoot(view);
    await act(async () => root?.render(<App />));
    expect(view.textContent).toContain("Understanding");
    expect(view.textContent).toContain("Next meaningful action");

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

    await act(async () => requiredElement<HTMLButtonElement>(view, ".understanding-action-context button").click());
    expect(view.textContent).toContain("Understanding");
    expect(view.textContent).toContain("Next meaningful action");
  });

  it("preserves theory context and restores heading focus across operational views", async () => {
    const view = document.createElement("div");
    container = view;
    document.body.append(view);
    root = createRoot(view);
    await act(async () => root?.render(<App />));

    const theoryOptions = [...view.querySelectorAll<HTMLButtonElement>('.theory-register [role="option"]')];
    await act(async () => theoryOptions[1].click());
    expect(requiredElement(view, ".theory-inspector h3").textContent).toBe("Visual density");

    await act(async () => requiredElement<HTMLButtonElement>(view, ".theory-source-links button").click());
    expect(document.activeElement).toBe(requiredElement(view, ".topbar h1"));
    expect(document.activeElement?.textContent).toBe("Source library");
    await act(async () => requiredElement<HTMLButtonElement>(view, ".understanding-action-context button").click());
    expect(requiredElement(view, ".theory-inspector h3").textContent).toBe("Visual density");

    await act(async () => requiredElement<HTMLButtonElement>(view, ".theory-evidence-trail button").click());
    expect(document.activeElement).toBe(requiredElement(view, ".topbar h1"));
    expect(document.activeElement?.textContent).toBe("Shared memory");
    await act(async () => requiredElement<HTMLButtonElement>(view, ".understanding-action-context button").click());
    expect(requiredElement(view, ".theory-inspector h3").textContent).toBe("Visual density");

    await act(async () => requiredElement<HTMLButtonElement>(view, ".next-action > button").click());
    expect(document.activeElement).toBe(requiredElement(view, ".topbar h1"));
    expect(document.activeElement?.textContent).toBe("Learning studio");
    await act(async () => requiredElement<HTMLButtonElement>(view, ".understanding-action-context button").click());
    expect(requiredElement(view, ".theory-inspector h3").textContent).toBe("Visual density");

    await act(async () => requiredElement<HTMLButtonElement>(view, 'button[aria-label="Foundry"]').click());
    expect(document.activeElement).toBe(requiredElement(view, ".topbar h1"));
    expect(document.activeElement?.textContent).toBe("Capability foundry");
    await act(async () => requiredElement<HTMLButtonElement>(view, ".understanding-action-context button").click());
    expect(requiredElement(view, ".theory-inspector h3").textContent).toBe("Visual density");
  });

  it("records separate human approval and activation transitions", async () => {
    const view = document.createElement("div");
    container = view;
    document.body.append(view);
    root = createRoot(view);
    await act(async () => root?.render(<App />));
    await act(async () => requiredElement<HTMLButtonElement>(view, 'button[aria-label="Foundry"]').click());

    const decisionReason = requiredElement<HTMLTextAreaElement>(view, '[id^="decision-reason-"]');
    await act(async () => setTextareaValue(decisionReason, "The declared evidence and boundaries are sufficient."));
    const approve = [...view.querySelectorAll<HTMLButtonElement>(".foundry-decision button")].find((button) =>
      button.textContent?.includes("Record approval")
    );
    if (!approve) throw new Error("Approval control missing");
    expect(approve.disabled).toBe(false);
    await act(async () => approve.click());

    expect(requiredElement(view, '.foundry-lifecycle [data-current="true"]').textContent).toContain("approved");
    expect(view.textContent).toContain("Approval recorded. Activation remains separate.");

    const activationReason = requiredElement<HTMLTextAreaElement>(view, '[id^="activation-reason-"]');
    await act(async () => setTextareaValue(activationReason, "Activate this approved version for the prepared task."));
    const activate = [...view.querySelectorAll<HTMLButtonElement>(".foundry-decision button")].find((button) =>
      button.textContent?.includes("Activate approved version")
    );
    if (!activate) throw new Error("Activation control missing");
    expect(activate.disabled).toBe(false);
    await act(async () => activate.click());

    expect(requiredElement(view, '.foundry-lifecycle [data-current="true"]').textContent).toContain("active");
    expect(view.textContent).toContain("Capability active");
  });
});
