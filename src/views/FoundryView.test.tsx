// @vitest-environment happy-dom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { seedEvents } from "../data/sample";
import { generateConsolidationProposal } from "../domain/consolidation";
import { practicalApplicationPayloadSchema } from "../domain/practicalEvidence";
import type { EvidenceEvent } from "../domain/types";
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
          practicalEvidence={workspace.practicalEvidence}
          microWorlds={workspace.microWorlds}
          consolidationProposals={workspace.consolidationProposals}
          onApprove={vi.fn()}
          onReject={vi.fn()}
          onActivate={vi.fn()}
          onApply={vi.fn()}
          onPracticalFeedback={vi.fn()}
          onProposeConsolidation={vi.fn()}
          onReviewConsolidation={vi.fn()}
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
          practicalEvidence={workspace.practicalEvidence}
          microWorlds={workspace.microWorlds}
          consolidationProposals={workspace.consolidationProposals}
          onApprove={vi.fn()}
          onReject={vi.fn()}
          onActivate={vi.fn()}
          onApply={vi.fn()}
          onPracticalFeedback={vi.fn()}
          onProposeConsolidation={vi.fn()}
          onReviewConsolidation={vi.fn()}
        />
      );
    });

    expect(view.textContent).toContain("Prior evaluation runs");
    expect(view.textContent).toContain("The audience was not identified.");
    expect(view.textContent).not.toContain(dismissedGap.title);
    expect(view.textContent).toContain("No currently detected gap targets this capability.");
  });

  it("returns rejected proposal evidence to the consolidation candidate queue", async () => {
    const workspace = reduceWorkspace(seedEvents);
    const capability = workspace.capabilities[0];
    const applicationEvent: EvidenceEvent = {
      id: "evt-reconsidered-application",
      type: "practical.application_recorded",
      kind: "practical_observation",
      createdAt: "2026-07-20T12:00:00.000Z",
      actor: "agent",
      summary: "Recorded a partial prepared capability application.",
      sourceIds: capability.manifest.sourceIds,
      payload: {
        capabilityId: capability.manifest.id,
        capabilityVersion: capability.manifest.version,
        inputSummary: "Review the prepared queue.",
        outputSummary: "The result needs another practical observation.",
        outcome: "partial",
        theoryElementIds: capability.manifest.theoryElementIds
      }
    };
    const proposal = generateConsolidationProposal({
      proposalId: "consolidation-rejected-reconsideration",
      createdAt: "2026-07-20T12:01:00.000Z",
      triggerEvents: [applicationEvent],
      theory: workspace.theory,
      capabilities: workspace.capabilities,
      checks: workspace.understandingChecks,
      microWorlds: workspace.microWorlds
    });
    const rejectedProposal = {
      ...proposal,
      evidenceEventId: "evt-rejected-consolidation",
      status: "rejected" as const,
      review: {
        proposalId: proposal.id,
        decision: "rejected" as const,
        reason: "Combine this result with another observation.",
        evidenceEventId: "evt-rejected-consolidation-review",
        createdAt: "2026-07-20T12:02:00.000Z",
        sourceIds: applicationEvent.sourceIds
      }
    };
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
          practicalEvidence={{
            applications: [
              {
                ...practicalApplicationPayloadSchema.parse(applicationEvent.payload),
                evidenceEventId: applicationEvent.id,
                createdAt: applicationEvent.createdAt
              }
            ],
            feedback: []
          }}
          microWorlds={workspace.microWorlds}
          consolidationProposals={[rejectedProposal]}
          onApprove={vi.fn()}
          onReject={vi.fn()}
          onActivate={vi.fn()}
          onApply={vi.fn()}
          onPracticalFeedback={vi.fn()}
          onProposeConsolidation={vi.fn()}
          onReviewConsolidation={vi.fn()}
        />
      );
    });

    expect(view.textContent).toContain("rejected");
    expect(view.textContent).toContain("The result needs another practical observation.");
    expect(view.textContent).toContain("Propose consolidation");
  });
});
