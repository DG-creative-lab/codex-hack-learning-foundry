// @vitest-environment happy-dom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { seedEvents } from "../data/sample";
import { reduceWorkspace } from "../domain/workspaceProjection";
import { MemoryView } from "./MemoryView";

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

describe("MemoryView", () => {
  it("switches between distinct human, agent, and shared projections", async () => {
    const workspace = reduceWorkspace(seedEvents);
    const view = document.createElement("div");
    container = view;
    document.body.append(view);
    root = createRoot(view);
    await act(async () => {
      root?.render(<MemoryView events={seedEvents} theory={workspace.theory} projections={workspace.memories} />);
    });

    expect(view.textContent).toContain("Evidence without a mastery score.");
    expect(view.textContent).toContain("Participation");
    expect(view.querySelector('[role="tabpanel"]')?.id).toBe("memory-panel-human");

    await act(async () => requiredElement<HTMLButtonElement>(view, "#memory-tab-agent").click());
    expect(view.querySelector('[role="tabpanel"]')?.id).toBe("memory-panel-agent");
    expect(view.textContent).toContain("Capability versions");
    expect(view.textContent).toContain("Evaluation does not imply human understanding.");

    await act(async () => requiredElement<HTMLButtonElement>(view, "#memory-tab-shared").click());
    expect(view.querySelector('[role="tabpanel"]')?.id).toBe("memory-panel-shared");
    expect(view.textContent).toContain("Three-way coverage");
    expect(view.textContent).toContain("Unresolved");
    expect(view.textContent?.toLowerCase()).not.toContain("mastery percentage");
  });
});
