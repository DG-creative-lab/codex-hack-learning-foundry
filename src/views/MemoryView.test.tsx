// @vitest-environment happy-dom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
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

const noOpMemoryActions = {
  onReviewGap: async () => undefined,
  onAnnotateGap: async () => undefined,
  onIntervene: () => undefined
};

describe("MemoryView", () => {
  it("switches between distinct human, agent, and shared projections", async () => {
    const workspace = reduceWorkspace(seedEvents);
    const view = document.createElement("div");
    container = view;
    document.body.append(view);
    root = createRoot(view);
    await act(async () => {
      root?.render(
        <MemoryView
          events={seedEvents}
          theory={workspace.theory}
          projections={workspace.memories}
          understandingGaps={workspace.understandingGaps}
          {...noOpMemoryActions}
        />
      );
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

    const coverageMarks = [...view.querySelectorAll<HTMLElement>(".coverage-marks abbr")];
    expect(coverageMarks.length).toBeGreaterThan(0);
    expect(
      coverageMarks.every((mark) => /coverage: (present|absent)$/.test(mark.getAttribute("aria-label") ?? ""))
    ).toBe(true);
    expect(coverageMarks.every((mark) => /[+-]/.test(mark.textContent ?? ""))).toBe(true);
    expect(view.textContent).toContain("Make cognitive debt visible");
    expect(view.textContent).toContain("Qualitative workflow signals, not a cognitive score.");
  });

  it("supports roving focus and keyboard activation across projection tabs", async () => {
    const workspace = reduceWorkspace(seedEvents);
    const view = document.createElement("div");
    container = view;
    document.body.append(view);
    root = createRoot(view);
    await act(async () => {
      root?.render(
        <MemoryView
          events={seedEvents}
          theory={workspace.theory}
          projections={workspace.memories}
          understandingGaps={workspace.understandingGaps}
          {...noOpMemoryActions}
        />
      );
    });
    const human = requiredElement<HTMLButtonElement>(view, "#memory-tab-human");
    const agent = requiredElement<HTMLButtonElement>(view, "#memory-tab-agent");
    const shared = requiredElement<HTMLButtonElement>(view, "#memory-tab-shared");

    expect(human.tabIndex).toBe(0);
    expect(agent.tabIndex).toBe(-1);
    human.focus();
    await act(async () => human.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })));
    expect(document.activeElement).toBe(agent);
    expect(agent.getAttribute("aria-selected")).toBe("true");
    expect(agent.tabIndex).toBe(0);

    await act(async () => agent.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true })));
    expect(document.activeElement).toBe(shared);
    expect(shared.getAttribute("aria-selected")).toBe("true");

    await act(async () => shared.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true })));
    expect(document.activeElement).toBe(human);
    expect(human.getAttribute("aria-selected")).toBe("true");

    await act(async () => human.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true })));
    expect(document.activeElement).toBe(shared);
    expect(shared.getAttribute("aria-selected")).toBe("true");
  });

  it("records signal review, annotation, and intervention commands", async () => {
    const workspace = reduceWorkspace(seedEvents);
    const view = document.createElement("div");
    container = view;
    document.body.append(view);
    root = createRoot(view);
    const onReviewGap = vi.fn(async () => undefined);
    const onAnnotateGap = vi.fn(async () => undefined);
    const onIntervene = vi.fn();
    await act(async () => {
      root?.render(
        <MemoryView
          events={seedEvents}
          theory={workspace.theory}
          projections={workspace.memories}
          understandingGaps={workspace.understandingGaps}
          onReviewGap={onReviewGap}
          onAnnotateGap={onAnnotateGap}
          onIntervene={onIntervene}
        />
      );
    });
    const firstGap = workspace.understandingGaps.gaps.find((gap) => gap.status === "open");
    if (!firstGap) throw new Error("Prepared understanding gap is missing");

    await act(async () => requiredElement<HTMLButtonElement>(view, ".gap-review-actions button").click());
    expect(onReviewGap).toHaveBeenCalledWith(firstGap.id, "confirmed");

    const textarea = requiredElement<HTMLTextAreaElement>(view, ".gap-annotation textarea");
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
      setter?.call(textarea, "Use the transfer task before activation.");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => requiredElement<HTMLButtonElement>(view, ".gap-annotation button").click());
    expect(onAnnotateGap).toHaveBeenCalledWith(firstGap.id, "Use the transfer task before activation.");

    await act(async () => requiredElement<HTMLButtonElement>(view, ".gap-intervention button").click());
    expect(onIntervene).toHaveBeenCalledWith(firstGap.recommendedIntervention.destination);
  });

  it("opens an intervention on the exact shared-theory element", async () => {
    const workspace = reduceWorkspace(seedEvents);
    const theoryElementId = workspace.memories.shared.elements.at(-1)?.theoryElementId;
    if (!theoryElementId) throw new Error("Prepared shared theory is missing");
    const view = document.createElement("div");
    container = view;
    document.body.append(view);
    root = createRoot(view);
    await act(async () => {
      root?.render(
        <MemoryView
          events={seedEvents}
          theory={workspace.theory}
          projections={workspace.memories}
          understandingGaps={workspace.understandingGaps}
          requestedTheoryElementId={theoryElementId}
          {...noOpMemoryActions}
        />
      );
    });

    expect(view.querySelector('[role="tabpanel"]')?.id).toBe("memory-panel-shared");
    expect(requiredElement(view, ".memory-evidence-inspector").textContent).toContain(theoryElementId);
  });
});
