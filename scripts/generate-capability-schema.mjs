import { readFile, writeFile } from "node:fs/promises";
import { capabilityStatusValues, capabilityTypeValues } from "../shared/capability-contract.js";

const schemaPath = new URL("../schemas/capability.schema.json", import.meta.url);
const current = await readFile(schemaPath, "utf8");
const schema = JSON.parse(current);
const generatedEnums = {
  status: capabilityStatusValues,
  type: capabilityTypeValues
};
const staleProperties = Object.entries(generatedEnums)
  .filter(([property, values]) => JSON.stringify(schema.properties?.[property]?.enum) !== JSON.stringify(values))
  .map(([property]) => property);

if (process.argv.includes("--check")) {
  if (staleProperties.length > 0) {
    throw new Error("Capability JSON Schema is out of date. Run pnpm schema:generate.");
  }
} else if (staleProperties.length > 0) {
  const generated = Object.entries(generatedEnums).reduce((contents, [property, values]) => {
    const enumProperty = new RegExp(`("${property}"\\s*:\\s*\\{\\s*"enum"\\s*:\\s*)\\[[^\\]]*\\]`);
    const serialized = `[${values.map((value) => JSON.stringify(value)).join(", ")}]`;
    return contents.replace(enumProperty, `$1${serialized}`);
  }, current);
  const generatedSchema = JSON.parse(generated);
  const unresolvedProperties = Object.entries(generatedEnums)
    .filter(
      ([property, values]) => JSON.stringify(generatedSchema.properties?.[property]?.enum) !== JSON.stringify(values)
    )
    .map(([property]) => property);

  if (unresolvedProperties.length > 0) {
    throw new Error(`Could not update capability schema properties: ${unresolvedProperties.join(", ")}`);
  }

  await writeFile(schemaPath, generated, "utf8");
}
