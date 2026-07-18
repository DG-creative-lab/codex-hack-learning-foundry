# ADR 0001: Append-only evidence ledger with derived projections

Status: accepted for the hackathon MVP

## Context

Learning Foundry must preserve provenance, contradictory evidence, human interpretation, agent synthesis, capability evaluations, and revisions. Model context cannot be the canonical database.

## Decision

Canonical memory is an append-only JSONL evidence ledger stored locally by the Electron main process. Runtime-validated events carry a stable identifier, epistemic kind, actor, timestamp, source links, summary, and structured payload.

The interface derives learner state, review items, capability state, and association views from this ledger. Prepared sample events are source-controlled; personal runtime events live in Electron's user-data directory and are excluded from Git.

Electron reads JSONL as a stream and validates one line at a time. The browser-only fallback uses a generation-indexed local journal: each append writes one event record and constant-size metadata instead of rewriting the complete event array. Existing browser arrays migrate into the journal on first load, and malformed records are quarantined before compaction.

## Why JSONL first

- Inspectable during the demo.
- Additive history makes provenance and reversibility natural.
- Avoids native SQLite packaging risk during the hackathon.
- Can migrate behind the same storage interface later.

## Consequences

We must validate every event at the boundary and design explicit compaction proposals. Slow consolidation may create summaries, but cannot erase source events or contradictory evidence.

Incremental persistence removes append-time growth and avoids buffering the Electron file as one string. Current projections still materialize the complete validated event set; snapshotting or paged projections remain a later concern when real ledger size justifies that complexity.
