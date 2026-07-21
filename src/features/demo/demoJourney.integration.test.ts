import { describe, expect, it } from "vitest";
import { createCapabilityWorkflow } from "../../application/capabilityWorkflow";
import { createConsolidationWorkflow } from "../../application/consolidationWorkflow";
import { createPreparedExecutionAdapter } from "../../application/executionAdapters";
import { createExecutionWorkflow } from "../../application/executionWorkflow";
import { createLearningWorkflow } from "../../application/learningWorkflow";
import { seedEvents } from "../../data/sample";
import type { EvidenceEvent } from "../../domain/types";
import { reduceWorkspace } from "../../domain/workspaceProjection";
import { type DemoStageId, deriveDemoJourney } from "./demoJourney";

describe("design-density demo journey", () => {
  it("runs offline from exploration through transfer, application, and three-way revision", async () => {
    const events = [...seedEvents];
    let sequence = 0;
    const createId = (prefix: string) => `${prefix}-demo-${++sequence}`;
    const now = () => `2026-07-21T07:${String(sequence).padStart(2, "0")}:00.000Z`;
    const workspace = () => reduceWorkspace(events);
    const append = async (event: EvidenceEvent) => {
      reduceWorkspace([...events, event]);
      events.push(event);
    };

    const learning = createLearningWorkflow({
      append,
      resolveExplainer: (id) => workspace().explainers.find((artifact) => artifact.id === id),
      resolveMicroWorld: (id) => workspace().microWorlds.find((artifact) => artifact.id === id),
      resolveUnderstandingCheck: (id) => workspace().understandingChecks.find((check) => check.id === id),
      createId,
      now
    });
    const world = workspace().microWorlds.find((artifact) => artifact.id === "micro-world-density-queue");
    if (!world) throw new Error("Prepared micro-world is missing");
    const variableValues = { "queue-spacing": 12, "queue-hierarchy": 80, "queue-information": 7 };
    const predictionEventId = await learning.recordMicroWorldPrediction(
      world.id,
      "prediction-tradeoff",
      variableValues
    );
    await learning.recordMicroWorldInteraction(world.id, predictionEventId, variableValues);
    await learning.recordMicroWorldReflection(
      world.id,
      world.reflectionPrompts[0],
      "More rows became visible, but hierarchy had to carry more of the scanning burden."
    );

    const transfer = workspace().understandingChecks.find((check) => check.kind === "transfer");
    if (!transfer) throw new Error("Prepared transfer check is missing");
    await learning.recordUnderstandingResponse(transfer.id, {
      answer:
        "Keep grouping space and target size, strengthen urgency hierarchy, and remove only fields that do not change the operator's next decision.",
      confidence: "medium",
      sourceSupport: { level: "reasoned", sourceIds: [], fragmentIds: [] }
    });
    expect(workspace().understandingGaps.gaps.some((gap) => gap.kind === "low_transfer_evidence")).toBe(false);

    const capabilityId = "value-density-reviewer";
    const capabilityWorkflow = createCapabilityWorkflow({
      append,
      resolveCapability: (id) => workspace().capabilities.find((capability) => capability.manifest.id === id),
      createId,
      now
    });
    await capabilityWorkflow.approve(capabilityId, "The prepared evaluation and transfer evidence satisfy the gate.");
    await capabilityWorkflow.activate(capabilityId, "Activate this approved version for the prepared UI review.");

    const execution = createExecutionWorkflow({
      append,
      resolveCapability: (id) => workspace().capabilities.find((capability) => capability.manifest.id === id),
      adapters: [createPreparedExecutionAdapter({ now: () => new Date(now()) })],
      createId,
      now
    });
    const applicationEventId = await execution.executeCapability(
      capabilityId,
      "Review the Learning Foundry source queue for useful density.",
      "prepared",
      false
    );

    const consolidation = createConsolidationWorkflow({
      append,
      resolveEvent: (id) => events.find((event) => event.id === id),
      resolveMicroWorld: (id) => workspace().microWorlds.find((artifact) => artifact.id === id),
      resolveProposal: (id) => workspace().consolidationProposals.find((proposal) => proposal.id === id),
      theory: workspace().theory,
      capabilities: workspace().capabilities,
      checks: workspace().understandingChecks,
      microWorlds: workspace().microWorlds,
      createId,
      now
    });
    const correctionEventId = await consolidation.recordFeedback(
      applicationEventId,
      "correction",
      "Preserve spacing that communicates grouping; reduce only space that carries no meaning.",
      "theory-concept-value-density"
    );
    const proposalId = await consolidation.propose([correctionEventId]);
    await consolidation.review(
      proposalId,
      "approved",
      "The practical correction is traceable and should revise both learning and capability work."
    );

    const finalWorkspace = workspace();
    const proposal = finalWorkspace.consolidationProposals.find((candidate) => candidate.id === proposalId);
    expect(proposal).toMatchObject({
      status: "approved",
      reviewItems: expect.arrayContaining([
        expect.objectContaining({ theoryElementIds: ["theory-concept-value-density"] })
      ]),
      theoryRevisions: expect.arrayContaining([
        expect.objectContaining({ revisesElementId: "theory-concept-value-density" })
      ]),
      capabilityRevisionRequests: expect.arrayContaining([expect.objectContaining({ capabilityId })])
    });
    expect(finalWorkspace.practicalEvidence.applications.at(-1)?.execution.completedAdapter).toBe("prepared");
    expect(
      finalWorkspace.memories.human.elements
        .find((element) => element.theoryElementId === "theory-purpose-review-value")
        ?.dimensions.participation.supportingEvidence.map((evidence) => evidence.eventId)
    ).toEqual(expect.arrayContaining([expect.stringContaining("evt-micro-world-interaction")]));

    const visited = new Set<DemoStageId>(["source", "theory", "explainer"]);
    const journey = deriveDemoJourney(finalWorkspace, visited);
    expect(journey.completedCount).toBe(journey.stages.length);
    expect(journey.stages.every((stage) => stage.state === "complete")).toBe(true);
  });
});
