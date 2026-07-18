import { readFile, writeFile } from "node:fs/promises";
import { capabilityStatusValues } from "../shared/capability-status.js";

const schemaPath = new URL("../schemas/capability.schema.json", import.meta.url);
const current = await readFile(schemaPath, "utf8");
const schema = JSON.parse(current);
const schemaStatuses = schema.properties?.status?.enum;
const isCurrent = JSON.stringify(schemaStatuses) === JSON.stringify(capabilityStatusValues);

if (process.argv.includes("--check")) {
  if (!isCurrent) {
    throw new Error("Capability JSON Schema is out of date. Run pnpm schema:generate.");
  }
} else if (!isCurrent) {
  const statusProperty = /("status"\s*:\s*\{\s*"enum"\s*:\s*)\[[^\]]*\]/;
  const statuses = `[${capabilityStatusValues.map((status) => JSON.stringify(status)).join(", ")}]`;
  const generated = current.replace(statusProperty, `$1${statuses}`);

  if (generated === current) {
    throw new Error("Could not find the capability status enum in the JSON Schema.");
  }

  await writeFile(schemaPath, generated, "utf8");
}
