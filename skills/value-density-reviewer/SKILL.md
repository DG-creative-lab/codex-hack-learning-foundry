---
name: value-density-reviewer
description: Review product interfaces, dashboards, operational tools, and user flows through visual, information, meaning, time, and value density. Use when Codex needs to critique or improve a UI, compare dense and sparse variants, evaluate whether whitespace or compression helps, adapt an interface to novice or expert audiences, or propose design changes grounded in user value rather than visual taste alone.
---

# Value Density Reviewer

Review the interface as a system of value, time, space, information, and meaning. Do not equate density with compact spacing.

## Workflow

1. Establish the target audience, their expertise, the primary task, and the valuable outcome. Ask for missing context when it would materially change the review.
2. Inspect the interface or supplied artifact. Separate observed evidence from inference.
3. Diagnose each density dimension using `references/density-framework.md`.
4. Name tradeoffs and declared constraints before proposing changes. Preserve accessibility, legibility, platform conventions, and critical exception states.
5. Propose the smallest changes that increase user value. Do not optimize every dimension independently.
6. Return the report using `references/output-contract.md`.
7. When a machine-readable report is requested or an evaluation is running, emit JSON matching the contract and run `node scripts/evaluate-review.mjs <report.json>`.

## Evidence Rules

- Label direct observations, source-grounded principles, user preferences, and hypotheses distinctly.
- Treat taste as preference evidence, not universal design truth.
- Explain how each recommendation helps the named audience achieve the named outcome.
- Cite the supplied source or artifact location when available.
- State uncertainty when timing, behavior, user expertise, or outcome data is missing.

## Boundaries

- Do not compress controls below accessible or declared size constraints.
- Do not remove whitespace that communicates grouping, hierarchy, or sequence.
- Do not infer product success from visual polish.
- Do not recommend added information without naming who needs it and when.
- Do not present the value-density ratio as a precise numeric measurement without empirical inputs.

