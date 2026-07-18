import { describe, expect, it } from "vitest";
import { livingTheory, principles, seedEvents } from "../data/sample";
import { deriveLivingTheory } from "./livingTheory";
import { evidenceEventSchema, type EvidenceEvent } from "./types";

describe("evidence ledger contract", () => {
  it("accepts the prepared seed events", () => {
    expect(evidenceEventSchema.array().parse(seedEvents).length).toBeGreaterThan(2);
  });

  it("rejects unclassified evidence", () => {
    const result = evidenceEventSchema.safeParse({
      id: "evt-invalid",
      type: "claim.created",
      kind: "fact",
      createdAt: new Date().toISOString(),
      actor: "agent",
      summary: "A claim without an epistemic class.",
      sourceIds: [],
      payload: {}
    });

    expect(result.success).toBe(false);
  });
});

describe("living theory projection", () => {
  it("derives a source-grounded theory from prepared ledger events", () => {
    expect(livingTheory.elements.some((element) => element.kind === "purpose")).toBe(true);
    expect(livingTheory.elements.filter((element) => element.kind === "concept")).toHaveLength(5);
    expect(livingTheory.relationships).toHaveLength(1);
    expect(livingTheory.sourceIds).toContain("source-ui-density-2024");
    expect(livingTheory.evidenceEventIds.every((id) => seedEvents.some((event) => event.id === id))).toBe(true);
  });

  it("keeps unsupported questions explicit and source facts grounded", () => {
    const unresolvedQuestion = livingTheory.elements.find((element) => element.kind === "question");
    expect(unresolvedQuestion).toMatchObject({ epistemicKind: "hypothesis", status: "unresolved", sourceIds: [] });

    const sourceFacts = livingTheory.elements.filter((element) => element.epistemicKind === "source_fact");
    expect(sourceFacts.every((element) => element.sourceIds.length > 0 && element.evidenceEventIds.length > 0)).toBe(true);
  });

  it("preserves the prior element when a revision supersedes it", () => {
    const original = livingTheory.elements.find((element) => element.id === "theory-purpose-review-value");
    expect(original).toBeDefined();

    const revision: EvidenceEvent = {
      id: "evt-theory-purpose-002",
      type: "theory.element_revised",
      kind: "user_interpretation",
      createdAt: "2026-07-14T11:00:00.000Z",
      actor: "human",
      summary: "Refined the purpose after applying the theory.",
      sourceIds: [],
      payload: {
        element: {
          id: "theory-purpose-review-value-v2",
          kind: "purpose",
          title: "Review for situated user value",
          statement: "Evaluate density by the useful outcome achieved for a named user in a specific workflow.",
          epistemicKind: "user_interpretation",
          status: "active",
          sourceIds: [],
          evidenceEventIds: [],
          revisesElementId: "theory-purpose-review-value"
        }
      }
    };

    const revised = deriveLivingTheory([...seedEvents, revision], {
      id: livingTheory.id,
      title: livingTheory.title
    });

    expect(revised.revision).toBe(1);
    expect(revised.elements.find((element) => element.id === original?.id)?.status).toBe("superseded");
    expect(revised.elements.find((element) => element.id === "theory-purpose-review-value-v2")?.revisesElementId).toBe(original?.id);
  });

  it("preserves contradictory elements as distinct evidence", () => {
    const contradictionEvents: EvidenceEvent[] = [
      {
        id: "evt-theory-claim-compact",
        type: "theory.element_recorded",
        kind: "source_fact",
        createdAt: "2026-07-14T11:00:00.000Z",
        actor: "system",
        summary: "Recorded a compact-layout claim.",
        sourceIds: ["source-a"],
        payload: {
          element: {
            id: "theory-claim-compact",
            kind: "concept",
            title: "Compact layouts improve scan speed",
            statement: "A compact layout can improve scan speed for an expert workflow.",
            epistemicKind: "source_fact",
            status: "active",
            sourceIds: ["source-a"],
            evidenceEventIds: []
          }
        }
      },
      {
        id: "evt-theory-claim-space",
        type: "theory.element_recorded",
        kind: "source_fact",
        createdAt: "2026-07-14T11:01:00.000Z",
        actor: "system",
        summary: "Recorded a spatial-grouping claim.",
        sourceIds: ["source-b"],
        payload: {
          element: {
            id: "theory-claim-space",
            kind: "contradiction",
            title: "Compression can damage scan speed",
            statement: "Removing meaningful spatial grouping can reduce scan speed.",
            epistemicKind: "source_fact",
            status: "unresolved",
            sourceIds: ["source-b"],
            evidenceEventIds: []
          }
        }
      },
      {
        id: "evt-theory-contradiction-link",
        type: "theory.relationship_recorded",
        kind: "agent_synthesis",
        createdAt: "2026-07-14T11:02:00.000Z",
        actor: "agent",
        summary: "Linked the claims as a context-dependent contradiction.",
        sourceIds: ["source-a", "source-b"],
        payload: {
          relationship: {
            id: "theory-relation-compact-space",
            kind: "contradicts",
            fromElementId: "theory-claim-space",
            toElementId: "theory-claim-compact",
            sourceIds: ["source-a", "source-b"],
            evidenceEventIds: []
          }
        }
      }
    ];

    const theory = deriveLivingTheory(contradictionEvents, {
      id: "theory-contradiction-test",
      title: "Contradiction test"
    });

    expect(theory.elements).toHaveLength(2);
    expect(theory.elements.map((element) => element.status)).toEqual(["active", "unresolved"]);
    expect(theory.relationships[0]?.kind).toBe("contradicts");
  });

  it("rejects an element whose epistemic class differs from its evidence event", () => {
    const mismatchedEvent: EvidenceEvent = {
      id: "evt-theory-mismatched-kind",
      type: "theory.element_recorded",
      kind: "agent_synthesis",
      createdAt: "2026-07-14T11:03:00.000Z",
      actor: "agent",
      summary: "Mismatched epistemic classification.",
      sourceIds: ["source-a"],
      payload: {
        element: {
          id: "theory-mismatched-kind",
          kind: "concept",
          title: "Invalid fact",
          statement: "An agent synthesis must not present itself as a source fact.",
          epistemicKind: "source_fact",
          status: "active",
          sourceIds: ["source-a"],
          evidenceEventIds: []
        }
      }
    };

    expect(() => deriveLivingTheory([mismatchedEvent], {
      id: "theory-mismatched-kind-test",
      title: "Mismatched kind test"
    })).toThrow("must use the epistemic kind of its evidence event");
  });

  it("rejects relationships to missing theory elements", () => {
    const invalidRelationship: EvidenceEvent = {
      id: "evt-theory-relationship-invalid",
      type: "theory.relationship_recorded",
      kind: "agent_synthesis",
      createdAt: "2026-07-14T11:01:00.000Z",
      actor: "agent",
      summary: "Invalid relationship.",
      sourceIds: [],
      payload: {
        relationship: {
          id: "theory-relation-invalid",
          kind: "depends-on",
          fromElementId: "theory-purpose-review-value",
          toElementId: "theory-element-missing",
          sourceIds: [],
          evidenceEventIds: []
        }
      }
    };

    expect(() => deriveLivingTheory([...seedEvents, invalidRelationship], {
      id: livingTheory.id,
      title: livingTheory.title
    })).toThrow("references an unknown element");
  });
});

describe("prepared design-density source", () => {
  it("contains five distinct transferable lenses", () => {
    expect(principles.map((principle) => principle.id)).toEqual([
      "visual-density",
      "information-density",
      "meaning-density",
      "time-density",
      "value-density"
    ]);
  });

  it("keeps every principle linked to a source section", () => {
    expect(principles.every((principle) => principle.sourceRef.length > 0)).toBe(true);
  });
});
