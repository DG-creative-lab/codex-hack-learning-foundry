// @vitest-environment happy-dom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { seedEvents } from "../data/sample";
import { reduceWorkspace } from "../domain/workspaceProjection";
import { FoundryView } from "./FoundryView";

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

describe("FoundryView", () => {
  it("exposes the approval evidence and keeps unevaluated drafts blocked", async () => {
    const workspace = reduceWorkspace(seedEvents);
    const view = document.createElement("div");
    container = view;
    document.body.append(view);
    root = createRoot(view);
    await act(async () => {
      root?.render(
        <FoundryView
          capabilities={workspace.capabilities}
          sources={workspace.sources}
          understandingGaps={workspace.understandingGaps}
          onApprove={vi.fn()}
          onReject={vi.fn()}
          onActivate={vi.fn()}
        />
      );
    });

    expect(view.textContent).toContain("Ready for human decision");
    expect(view.textContent).toContain("Source coverage");
    expect(view.textContent).toContain("Operating boundaries");
    expect(view.textContent).toContain("Audience is identified");
    expect(view.textContent).toContain("Relevant understanding gaps");

    const draft = [...view.querySelectorAll<HTMLButtonElement>(".foundry-register > button")].find((button) =>
      button.textContent?.includes("design-density-knowledge")
    );
    if (!draft) throw new Error("Prepared draft missing");
    await act(async () => draft.click());
    expect(view.textContent).toContain("Evaluation required before decision");
    expect(view.textContent).toContain("synthesis alone cannot enable approval or activation");
    expect(requiredElement(view, '.foundry-lifecycle [data-current="true"]').textContent).toContain("draft");
  });

  it("shows prior evaluation failures and excludes dismissed gaps from current warnings", async () => {
    const workspace = reduceWorkspace(seedEvents);
    const prepared = workspace.capabilities[0];
    if (!prepared.evaluation) throw new Error("Prepared evaluation missing");
    const failedRecord = {
      ...prepared.evaluation,
      evidenceEventId: "evt-capability-evaluation-prior-failure",
      createdAt: "2026-07-14T09:59:00.000Z",
      result: {
        ...prepared.evaluation.result,
        passed: prepared.evaluation.result.total - 1,
        cases: prepared.evaluation.result.cases.map((result, index) =>
          index === 0 ? { ...result, status: "failed" as const, evidence: "The audience was not identified." } : result
        )
      }
    };
    const capability = {
      ...prepared,
      evaluationHistory: [failedRecord, ...prepared.evaluationHistory]
    };
    const dismissedGap = { ...workspace.understandingGaps.gaps[0], status: "dismissed" as const };
    const view = document.createElement("div");
    container = view;
    document.body.append(view);
    root = createRoot(view);
    await act(async () => {
      root?.render(
        <FoundryView
          capabilities={[capability, ...workspace.capabilities.slice(1)]}
          sources={workspace.sources}
          understandingGaps={{ gaps: [dismissedGap], openCount: 0, confirmedCount: 0, dismissedCount: 1 }}
          onApprove={vi.fn()}
          onReject={vi.fn()}
          onActivate={vi.fn()}
        />
      );
    });

    expect(view.textContent).toContain("Prior evaluation runs");
    expect(view.textContent).toContain("The audience was not identified.");
    expect(view.textContent).not.toContain(dismissedGap.title);
    expect(view.textContent).toContain("No currently detected gap targets this capability.");
  });
});
