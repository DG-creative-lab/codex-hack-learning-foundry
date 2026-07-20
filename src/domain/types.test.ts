import { describe, expect, it } from "vitest";
import capabilitySchema from "../../schemas/capability.schema.json";
import { capabilityStatusValues } from "../../shared/capability-contract.js";
import { designDensityTheoryMetadata, principles, seedEvents } from "../data/sample";
import { deriveLivingTheory } from "./livingTheory";
import { deriveMemoryProjections } from "./memoryProjections";
import { capabilityStatusSchema, type EvidenceEvent, evidenceEventSchema, livingTheorySchema } from "./types";

const livingTheory = deriveLivingTheory(seedEvents, designDensityTheoryMetadata);

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

  it("rejects source facts without provenance", () => {
    const result = evidenceEventSchema.safeParse({
      id: "evt-ungrounded",
      type: "source.imported",
      kind: "source_fact",
      createdAt: new Date().toISOString(),
      actor: "system",
      summary: "A fact with no source.",
      sourceIds: [],
      payload: {}
    });

    expect(result.success).toBe(false);
  });
});

describe("capability status contract", () => {
  it("keeps runtime validation and the JSON Schema aligned with the ordered lifecycle", () => {
    expect(capabilityStatusSchema.options).toEqual(capabilityStatusValues);
    expect(capabilitySchema.properties.status.enum).toEqual(capabilityStatusValues);
  });

  it("exposes explicit human-decision and supersession states", () => {
    expect(capabilityStatusValues).toEqual(["draft", "evaluated", "approved", "active", "rejected", "superseded"]);
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
    expect(sourceFacts.every((element) => element.sourceIds.length > 0 && element.evidenceEventIds.length > 0)).toBe(
      true
    );
  });

  it("rejects duplicate evidence event IDs", () => {
    expect(() => deriveLivingTheory([seedEvents[0], seedEvents[0]], designDensityTheoryMetadata)).toThrow(
      `Evidence event ID ${seedEvents[0]?.id} is duplicated`
    );
  });

  it("rejects duplicate theory element IDs", () => {
    const original = seedEvents.find((event) => event.type === "theory.element_recorded");
    if (!original) throw new Error("Theory element fixture is missing");
    const duplicate = { ...original, id: "evt-duplicate-theory-element" };

    expect(() => deriveLivingTheory([...seedEvents, duplicate], designDensityTheoryMetadata)).toThrow(
      "Theory element ID theory-purpose-review-value is duplicated"
    );
  });

  it("rejects duplicate theory relationship IDs", () => {
    const original = seedEvents.find((event) => event.type === "theory.relationship_recorded");
    if (!original) throw new Error("Theory relationship fixture is missing");
    const duplicate = { ...original, id: "evt-duplicate-theory-relationship" };

    expect(() => deriveLivingTheory([...seedEvents, duplicate], designDensityTheoryMetadata)).toThrow(
      "Theory relationship ID theory-relation-purpose-accessibility is duplicated"
    );
  });

  it("requires a revision to use a different element ID", () => {
    const invalidRevision: EvidenceEvent = {
      id: "evt-theory-purpose-invalid-revision",
      type: "theory.element_revised",
      kind: "user_interpretation",
      createdAt: "2026-07-14T10:30:00.000Z",
      actor: "human",
      summary: "Invalid in-place theory revision.",
      sourceIds: [],
      payload: {
        element: {
          id: "theory-purpose-review-value",
          kind: "purpose",
          title: "Invalid in-place revision",
          statement: "A revision cannot erase its predecessor.",
          epistemicKind: "user_interpretation",
          status: "active",
          sourceIds: [],
          evidenceEventIds: [],
          revisesElementId: "theory-purpose-review-value"
        }
      }
    };

    expect(() => deriveLivingTheory([...seedEvents, invalidRevision], designDensityTheoryMetadata)).toThrow(
      "must use a new element ID"
    );
  });

  it("rejects source facts without merged provenance", () => {
    const ungroundedFact: EvidenceEvent = {
      id: "evt-theory-ungrounded-fact",
      type: "theory.element_recorded",
      kind: "source_fact",
      createdAt: "2026-07-14T10:31:00.000Z",
      actor: "system",
      summary: "Ungrounded source fact.",
      sourceIds: [],
      payload: {
        element: {
          id: "theory-ungrounded-fact",
          kind: "concept",
          title: "Ungrounded fact",
          statement: "This statement has no source provenance.",
          epistemicKind: "source_fact",
          status: "active",
          sourceIds: [],
          evidenceEventIds: []
        }
      }
    };

    expect(() =>
      deriveLivingTheory([ungroundedFact], {
        id: "theory-ungrounded-test",
        title: "Ungrounded test",
        sourceIds: []
      })
    ).toThrow("Source facts must reference at least one source");
  });

  it("accepts source-fact provenance supplied by the evidence envelope", () => {
    const envelopedFact: EvidenceEvent = {
      id: "evt-theory-enveloped-fact",
      type: "theory.element_recorded",
      kind: "source_fact",
      createdAt: "2026-07-14T10:32:00.000Z",
      actor: "system",
      summary: "Source provenance is carried by the event envelope.",
      sourceIds: ["source-a"],
      payload: {
        element: {
          id: "theory-enveloped-fact",
          kind: "concept",
          title: "Envelope-grounded fact",
          statement: "The projector merges event and element provenance before validation.",
          epistemicKind: "source_fact",
          status: "active",
          sourceIds: [],
          evidenceEventIds: []
        }
      }
    };

    const theory = deriveLivingTheory([envelopedFact], {
      id: "theory-envelope-provenance-test",
      title: "Envelope provenance test",
      sourceIds: ["source-a"]
    });

    expect(theory.elements[0]?.sourceIds).toEqual(["source-a"]);
  });

  it("rejects provenance outside the approved source registry", () => {
    expect(() =>
      deriveLivingTheory(seedEvents, {
        ...designDensityTheoryMetadata,
        sourceIds: ["source-ui-density-2024"]
      })
    ).toThrow("references unknown source source-wcag-target-size");
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
      title: livingTheory.title,
      sourceIds: designDensityTheoryMetadata.sourceIds
    });

    expect(revised.revision).toBe(1);
    expect(revised.elements.find((element) => element.id === original?.id)?.status).toBe("superseded");
    expect(revised.elements.find((element) => element.id === "theory-purpose-review-value-v2")?.revisesElementId).toBe(
      original?.id
    );
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
      title: "Contradiction test",
      sourceIds: ["source-a", "source-b"]
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

    expect(() =>
      deriveLivingTheory([mismatchedEvent], {
        id: "theory-mismatched-kind-test",
        title: "Mismatched kind test",
        sourceIds: ["source-a"]
      })
    ).toThrow("must use the epistemic kind of its evidence event");
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

    expect(() =>
      deriveLivingTheory([...seedEvents, invalidRelationship], {
        id: livingTheory.id,
        title: livingTheory.title,
        sourceIds: designDensityTheoryMetadata.sourceIds
      })
    ).toThrow("references an unknown element");
  });

  it("does not expose independently mutable element or relationship ID arrays", () => {
    expect(
      livingTheorySchema.safeParse({
        ...livingTheory,
        elementIds: ["missing"],
        relationshipIds: ["missing"]
      }).success
    ).toBe(false);
  });

  it("rejects duplicate identities at the public aggregate boundary", () => {
    expect(
      livingTheorySchema.safeParse({
        ...livingTheory,
        elements: [...livingTheory.elements, livingTheory.elements[0]]
      }).success
    ).toBe(false);
    expect(
      livingTheorySchema.safeParse({
        ...livingTheory,
        relationships: [...livingTheory.relationships, livingTheory.relationships[0]]
      }).success
    ).toBe(false);
  });
});

describe("memory projections", () => {
  it("references the live theory from both human and agent states", () => {
    const projections = deriveMemoryProjections({
      theory: livingTheory,
      events: seedEvents,
      understandingChecks: [],
      microWorlds: [],
      capabilities: []
    });
    const activeElementIds = livingTheory.elements
      .filter((element) => element.status !== "superseded")
      .map((element) => element.id);

    expect(projections.human.theoryId).toBe(livingTheory.id);
    expect(projections.agent.theoryId).toBe(livingTheory.id);
    expect(projections.human.theoryElementIds).toEqual(activeElementIds);
    expect(projections.agent.theoryElementIds).toEqual(activeElementIds);
  });

  it("updates both projections when a runtime ledger event revises the theory", () => {
    const revision: EvidenceEvent = {
      id: "evt-theory-runtime-revision",
      type: "theory.element_revised",
      kind: "user_interpretation",
      createdAt: "2026-07-14T12:00:00.000Z",
      actor: "human",
      summary: "Refined the theory during a live learning session.",
      sourceIds: [],
      payload: {
        element: {
          id: "theory-purpose-review-value-runtime",
          kind: "purpose",
          title: "Review for situated value",
          statement: "Evaluate density for a named user in a specific workflow.",
          epistemicKind: "user_interpretation",
          status: "active",
          sourceIds: [],
          evidenceEventIds: [],
          revisesElementId: "theory-purpose-review-value"
        }
      }
    };
    const runtimeEvents = [...seedEvents, revision];
    const runtimeTheory = deriveLivingTheory(runtimeEvents, designDensityTheoryMetadata);
    const projections = deriveMemoryProjections({
      theory: runtimeTheory,
      events: runtimeEvents,
      understandingChecks: [],
      microWorlds: [],
      capabilities: []
    });

    expect(projections.human.theoryElementIds).toContain("theory-purpose-review-value-runtime");
    expect(projections.agent.theoryElementIds).toContain("theory-purpose-review-value-runtime");
    expect(projections.human.theoryElementIds).not.toContain("theory-purpose-review-value");
    expect(projections.human.contributedTheoryElementIds).toContain("theory-purpose-review-value-runtime");
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
