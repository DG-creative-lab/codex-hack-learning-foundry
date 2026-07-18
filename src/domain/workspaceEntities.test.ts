import { describe, expect, it } from "vitest";
import capabilityJsonSchema from "../../schemas/capability.schema.json";
import { capabilityStatusValues, capabilityTypeValues } from "../../shared/capability-contract.js";
import { capabilities, learningArtifacts, workspaceSources } from "../data/workspace";
import {
  capabilityManifestSchema,
  foundryCapabilitySchema,
  learningArtifactSchema,
  sourceRecordSchema
} from "./workspaceEntities";

describe("workspace entity contracts", () => {
  it("validates every prepared workspace entity", () => {
    expect(sourceRecordSchema.array().parse(workspaceSources)).toHaveLength(3);
    expect(learningArtifactSchema.array().parse(learningArtifacts)).toHaveLength(4);
    expect(foundryCapabilitySchema.array().parse(capabilities)).toHaveLength(3);
  });

  it("rejects invalid bounded metrics", () => {
    expect(sourceRecordSchema.safeParse({ ...workspaceSources[0], progress: 101 }).success).toBe(false);
    expect(learningArtifactSchema.safeParse({ ...learningArtifacts[0], progress: -1 }).success).toBe(false);
    expect(foundryCapabilitySchema.safeParse({ ...capabilities[0], evaluation: { passed: 9, total: 8 } }).success).toBe(
      false
    );
  });

  it("keeps the portable capability manifest aligned with its JSON Schema", () => {
    const manifest = capabilityManifestSchema.parse(capabilities[0].manifest);
    expect(Object.keys(capabilityJsonSchema.properties).sort()).toEqual(Object.keys(manifest).sort());
    expect([...capabilityJsonSchema.required].sort()).toEqual(
      Object.keys(manifest)
        .filter((property) => property !== "evaluationFixture")
        .sort()
    );
    expect(capabilityJsonSchema.properties.type.enum).toEqual(capabilityTypeValues);
    expect(capabilityJsonSchema.properties.status.enum).toEqual(capabilityStatusValues);
  });
});
