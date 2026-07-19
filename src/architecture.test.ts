import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("application boundaries", () => {
  it("keeps the UI shell independent of source domain and extraction internals", () => {
    const appSource = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");

    expect(appSource).toContain('from "./application/sourceWorkflow"');
    expect(appSource).not.toMatch(/from "\.\/domain\/sourcePipeline"/);
    expect(appSource).not.toMatch(/from "\.\/services\/sourceExtraction"/);
  });
});
