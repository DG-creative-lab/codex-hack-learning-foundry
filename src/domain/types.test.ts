import { describe, expect, it } from "vitest";
import { principles, seedEvents } from "../data/sample";
import { evidenceEventSchema } from "./types";

describe("evidence ledger contract", () => {
  it("accepts the prepared seed events", () => {
    expect(evidenceEventSchema.array().parse(seedEvents)).toHaveLength(2);
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

