import { describe, expect, it } from "vitest";
import capabilityJsonSchema from "../../schemas/capability.schema.json";
import { capabilityStatusValues, capabilityTypeValues } from "../../shared/capability-contract.js";
import { capabilities, learningArtifacts, workspaceSources } from "../data/workspace";
import {
  capabilityEvaluationSchema,
  capabilityManifestSchema,
  learningArtifactSchema,
  sourceRecordSchema
} from "./workspaceEntities";

describe("workspace entity contracts", () => {
  it("validates every prepared workspace entity", () => {
    expect(sourceRecordSchema.array().parse(workspaceSources)).toHaveLength(3);
    expect(learningArtifactSchema.array().parse(learningArtifacts)).toHaveLength(4);
    expect(capabilities.map((capability) => capabilityManifestSchema.parse(capability.manifest))).toHaveLength(3);
    expect(capabilityEvaluationSchema.parse(capabilities[0].evaluation).passed).toBe(
      capabilities[0].manifest.evaluationCases.length
    );
  });

  it("rejects invalid bounded metrics", () => {
    expect(sourceRecordSchema.safeParse({ ...workspaceSources[0], progress: 101 }).success).toBe(false);
    expect(learningArtifactSchema.safeParse({ ...learningArtifacts[0], progress: -1 }).success).toBe(false);
    expect(capabilityEvaluationSchema.safeParse({ ...capabilities[0].evaluation, passed: 9, total: 4 }).success).toBe(
      false
    );
  });

  it("keeps the portable capability manifest aligned with its JSON Schema", () => {
    const manifest = capabilityManifestSchema.parse(capabilities[0].manifest);
    expect(Object.keys(capabilityJsonSchema.properties)).toEqual(expect.arrayContaining(Object.keys(manifest)));
    expect([...capabilityJsonSchema.required].sort()).toEqual(
      Object.keys(manifest)
        .filter((property) => property !== "evaluationFixture")
        .sort()
    );
    expect(capabilityJsonSchema.properties.type.enum).toEqual(capabilityTypeValues);
    expect(capabilityJsonSchema.properties.status.enum).toEqual(capabilityStatusValues);
  });
});
