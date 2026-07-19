import { describe, expect, it } from "vitest";
import { createWebSourceDocument, normalizeSourceUnits, SOURCE_CONTENT_LIMITS } from "./source-content.js";

describe("source content contract", () => {
  it("bounds persisted units without discarding the remainder of a long unit", () => {
    const content = "word ".repeat(SOURCE_CONTENT_LIMITS.maxUnitCharacters);
    const units = normalizeSourceUnits([{ content, location: { kind: "text", label: "Lines 1-20" } }]);

    expect(units.length).toBeGreaterThan(1);
    expect(units.every((unit) => unit.content.length <= SOURCE_CONTENT_LIMITS.maxUnitCharacters)).toBe(true);
    expect(units[0].location.label).toContain("part 1");
  });

  it("caps the number of units admitted to the replayed ledger", () => {
    const units = normalizeSourceUnits(
      Array.from({ length: SOURCE_CONTENT_LIMITS.maxUnits + 10 }, (_, index) => ({
        content: `Evidence unit ${index}`,
        location: { kind: "text", label: `Line ${index + 1}` }
      }))
    );

    expect(units).toHaveLength(SOURCE_CONTENT_LIMITS.maxUnits);
  });

  it("applies one web-document normalization contract across runtimes", () => {
    const document = createWebSourceDocument({
      url: "https://example.com/notes",
      title: "  Design   notes  ",
      author: "",
      fingerprint: "a".repeat(64),
      units: [
        { content: "short", location: { kind: "web", label: "Block 1" } },
        {
          content: "  Useful interfaces preserve meaningful context for the user.  ",
          location: { kind: "web", label: "Block 2" }
        }
      ]
    });

    expect(document).toMatchObject({ title: "Design notes", author: "example.com", format: "Web page" });
    expect(document.units).toEqual([
      {
        content: "Useful interfaces preserve meaningful context for the user.",
        location: { kind: "web", label: "Block 2" }
      }
    ]);
  });
});
