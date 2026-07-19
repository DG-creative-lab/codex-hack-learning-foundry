# ADR 0005: Distinct human, agent, and shared-theory memory projections

Status: accepted for the hackathon MVP

## Context

Human confidence, demonstrated human understanding, agent synthesis, and validated capability behavior are different epistemic states. A universal mastery percentage would hide missing dimensions, allow success on one side to promote the other, and obscure stale or contradictory evidence.

The evidence ledger and Living Theory already provide canonical history and stable theory identifiers. Memory therefore needs deterministic projections over those records rather than another mutable state store.

## Decision

Derive three separate memory projections from the complete validated workspace state.

The human projection represents recall, explanation, prediction, transfer, participation, and uncertainty handling independently for every active theory element. Understanding-check evaluations contribute their declared signals. When an evaluation is disputed, its provisional signals are suppressed and the correction event remains as mixed uncertainty evidence linked to the original attempt. A micro-world prediction contributes an unassessed hypothesis signal, while deliberately recorded interactions and interaction-linked reflections contribute participation evidence. Modeled outcome values never become human-understanding evidence.

The agent projection categorizes accessible theory as knowledge, assumptions, boundaries, and decisions. Capability registrations provide version records, and evaluations provide supporting, mixed, or failure evidence. Agent evaluation and execution events never update the human projection.

The shared-theory projection reports source, human, and agent coverage separately from agreement. Human and agent coverage is derived from actors on the element's evidence and every linked relationship event, so authorship remains visible even without understanding-check evidence. Explicit contradiction relationships produce contested state. Questions and unresolved elements remain unresolved. Human challenge evidence can prevent a supported agreement state without being misclassified as a contradiction of the theory itself.

Every projected signal carries its evidence event ID, timestamp, epistemic kind, summary, source IDs, and rationale. Projections calculate their deterministic `asOf` time from the latest ledger event. Evidence older than 30 days relative to that point is marked stale for the MVP; history remains intact.

## Consequences

- No projection exposes a mastery percentage or promotes confidence into source truth.
- Recall support cannot imply transfer, participation, or capability readiness.
- Capability success and failure remain visible only in agent memory unless later consolidation proposes a traceable cross-projection revision.
- Shared coverage can be complete while agreement remains partial, contested, or unresolved.
- Unrecorded interface exploration does not alter memory.
- Replaying the same ledger produces the same projection and freshness state.
- The 30-day staleness threshold is an explicit MVP policy that can later become domain-configurable without changing canonical evidence.
