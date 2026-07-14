# ADR 0001: Append-only evidence ledger with derived projections

Status: accepted for the hackathon MVP

## Context

Learning Foundry must preserve provenance, contradictory evidence, human interpretation, agent synthesis, capability evaluations, and revisions. Model context cannot be the canonical database.

## Decision

Canonical memory is an append-only JSONL evidence ledger stored locally by the Electron main process. Runtime-validated events carry a stable identifier, epistemic kind, actor, timestamp, source links, summary, and structured payload.

The interface derives learner state, review items, capability state, and association views from this ledger. Prepared sample events are source-controlled; personal runtime events live in Electron's user-data directory and are excluded from Git.

## Why JSONL first

- Inspectable during the demo.
- Additive history makes provenance and reversibility natural.
- Avoids native SQLite packaging risk during the hackathon.
- Can migrate behind the same storage interface later.

## Consequences

We must validate every event at the boundary and design explicit compaction proposals. Slow consolidation may create summaries, but cannot erase source events or contradictory evidence.

