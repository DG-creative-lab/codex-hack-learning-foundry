#!/usr/bin/env node

import { readFile } from "node:fs/promises";

const reportPath = process.argv[2];
if (!reportPath) {
  console.error("Usage: node evaluate-review.mjs <report.json>");
  process.exit(2);
}

const report = JSON.parse(await readFile(reportPath, "utf8"));
const requiredLenses = ["visual", "information", "meaning", "time", "value"];
const presentLenses = new Set(Array.isArray(report.lenses) ? report.lenses.map((lens) => lens.id) : []);

const checks = [
  { id: "audience", pass: typeof report.audience === "string" && report.audience.trim().length >= 8 },
  { id: "outcome", pass: typeof report.outcome === "string" && report.outcome.trim().length >= 8 },
  { id: "observations", pass: Array.isArray(report.observations) && report.observations.length > 0 },
  { id: "five-lenses", pass: requiredLenses.every((lens) => presentLenses.has(lens)) },
  {
    id: "lens-evidence",
    pass: Array.isArray(report.lenses) && report.lenses.every((lens) =>
      typeof lens.diagnosis === "string" &&
      lens.diagnosis.trim().length > 0 &&
      Array.isArray(lens.evidenceRefs) &&
      lens.evidenceRefs.length > 0 &&
      typeof lens.confidence === "number" &&
      lens.confidence >= 0 &&
      lens.confidence <= 1
    )
  },
  {
    id: "recommendation-traceability",
    pass: Array.isArray(report.recommendations) && report.recommendations.length > 0 && report.recommendations.every((item) =>
      typeof item.change === "string" &&
      typeof item.expectedValue === "string" &&
      Array.isArray(item.evidenceRefs) &&
      item.evidenceRefs.length > 0 &&
      typeof item.tradeoff === "string" &&
      typeof item.verification === "string"
    )
  },
  { id: "constraints", pass: Array.isArray(report.constraints) && report.constraints.length > 0 },
  { id: "uncertainty", pass: Array.isArray(report.uncertainties) }
];

const result = {
  passed: checks.every((check) => check.pass),
  score: checks.filter((check) => check.pass).length,
  total: checks.length,
  checks
};

console.log(JSON.stringify(result, null, 2));
process.exit(result.passed ? 0 : 1);

