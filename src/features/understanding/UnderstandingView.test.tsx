// @vitest-environment happy-dom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { seedEvents } from "../../data/sample";
import { reduceWorkspace, type WorkspaceProjection } from "../../domain/workspaceProjection";
import { UnderstandingView } from "./UnderstandingView";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
let container: HTMLDivElement | undefined;

afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
});

function requiredElement<T extends Element>(parent: ParentNode, selector: string): T {
  const element = parent.querySelector<T>(selector);
  if (!element) throw new Error(`Expected element ${selector}`);
  return element;
}

function learningProps(workspace: WorkspaceProjection) {
  return {
    artifacts: workspace.learningArtifacts,
    explainers: workspace.explainers,
    microWorlds: workspace.microWorlds,
    checks: workspace.understandingChecks,
    evidenceVectors: workspace.understandingEvidenceVectors,
    reviewItems: workspace.targetedReviewItems,
    fragments: workspace.sourceFragments,
    sources: workspace.sources,
    onFeedback: async () => undefined,
    onResponse: async () => undefined,
    onDispute: async () => undefined,
    onPreference: async () => undefined,
    onMicroWorldPrediction: async () => "evt-test-prediction",
    onMicroWorldInteraction: async () => undefined,
    onMicroWorldReflection: async () => undefined
  };
}

async function renderView(
  workspace: WorkspaceProjection,
  overrides: Partial<Parameters<typeof UnderstandingView>[0]> = {}
) {
  const view = document.createElement("div");
  container = view;
  document.body.append(view);
  root = createRoot(view);
  await act(async () => {
    root?.render(
      <UnderstandingView
        workspace={workspace}
        loading={false}
        learningProps={learningProps(workspace)}
        onAddSource={() => undefined}
        onOpenSource={() => undefined}
        onOpenMemory={() => undefined}
        onOpenFoundry={() => undefined}
        {...overrides}
      />
    );
  });
  return view;
}

describe("UnderstandingView", () => {
  it("moves through theory by keyboard and opens exact provenance and memory destinations", async () => {
    const workspace = reduceWorkspace(seedEvents);
    const onOpenSource = vi.fn();
    const onOpenMemory = vi.fn();
    const view = await renderView(workspace, { onOpenSource, onOpenMemory });
    const options = [...view.querySelectorAll<HTMLButtonElement>('.theory-register [role="option"]')];

    expect(view.textContent).toContain("Next meaningful action");
    expect(view.textContent).toContain("Review for user value");
    options[0].focus();
    await act(async () => options[0].dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })));
    expect(options[1].getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(options[1]);
    expect(requiredElement(view, ".theory-inspector h3").textContent).toBe("Visual density");

    await act(async () => requiredElement<HTMLButtonElement>(view, ".theory-source-links button").click());
    expect(onOpenSource).toHaveBeenCalledWith("source-ui-density-2024");
    await act(async () => requiredElement<HTMLButtonElement>(view, ".theory-evidence-trail button").click());
    expect(onOpenMemory).toHaveBeenCalledWith("theory-concept-visual-density");
  });

  it("opens the prepared next action and returns to the Living Theory", async () => {
    const view = await renderView(reduceWorkspace(seedEvents));

    await act(async () => requiredElement<HTMLButtonElement>(view, ".next-action > button").click());
    expect(view.textContent).toContain("Predict what would happen");
    expect(view.textContent).toContain("Living Theory");
    await act(async () => requiredElement<HTMLButtonElement>(view, ".understanding-action-context button").click());
    expect(view.textContent).toContain("Next meaningful action");
    expect(view.textContent).toContain("Review for user value");
  });

  it("renders loading and empty states with a recoverable source action", async () => {
    const workspace = reduceWorkspace(seedEvents);
    const view = await renderView(workspace, { loading: true });
    expect(view.textContent).toContain("Replaying evidence");
    expect(requiredElement(view, '[aria-busy="true"]')).toBeTruthy();

    const empty = { ...workspace, theory: { ...workspace.theory, elements: [] } };
    const onAddSource = vi.fn();
    await act(async () => {
      root?.render(
        <UnderstandingView
          workspace={empty}
          loading={false}
          learningProps={learningProps(empty)}
          onAddSource={onAddSource}
          onOpenSource={() => undefined}
          onOpenMemory={() => undefined}
          onOpenFoundry={() => undefined}
        />
      );
    });
    expect(view.textContent).toContain("No shared theory yet");
    await act(async () => requiredElement<HTMLButtonElement>(view, ".understanding-state-view button").click());
    expect(onAddSource).toHaveBeenCalledOnce();
  });
});
