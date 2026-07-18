# ADR 0003: Living Theory as the shared product model

Status: accepted for the hackathon MVP

## Context

The evidence ledger preserves source facts, human interpretation, agent synthesis, practical observations, and validated behavior. Human and agent projections can still diverge without a shared representation of why a system exists, how its concepts relate, which decisions shaped it, and where understanding remains incomplete.

Learning Foundry needs that representation without turning generated synthesis into canonical truth or pretending human and agent knowledge are identical.

## Decision

Introduce a domain-independent Living Theory derived deterministically from append-only evidence events.

A Living Theory contains:

- Purpose, concepts, causal models, decisions, assumptions, boundaries, contradictions, and unresolved questions.
- Typed relationships including dependencies, rationale, change, prediction, support, contradiction, constraints, and uncertainty.
- Fragment- or source-level provenance where available.
- Explicit epistemic classification for source fact, human interpretation, agent synthesis, practical observation, hypothesis, and validated behavior.
- Revision links that supersede an earlier element without deleting it.

The ledger remains canonical. Living Theory is a rebuildable projection and cannot silently resolve contradictions, activate capabilities, or overwrite source evidence.

The application derives this projection from the complete runtime ledger, not from prepared sample output. Human and agent memory projections both reference the same Living Theory ID and active element IDs while retaining their own contribution and evidence sets.

Projection boundaries enforce the following invariants:

- Evidence event, theory element, and relationship IDs are unique.
- A revision has a new ID and preserves its superseded predecessor.
- Source facts retain provenance after event-envelope and element provenance are merged.
- Every referenced source exists in the approved source registry supplied to the projection.
- Aggregate identity is derived from element and relationship objects rather than duplicated ID arrays.

## Consequences

- Sources, human learning, agent memory, and capabilities can reference stable theory identifiers.
- Runtime evidence immediately updates the shared theory and both memory projections.
- Unsupported questions and interpretations remain useful when they are explicitly classified.
- Relationship endpoints are validated during projection so broken theory graphs fail visibly.
- Later learning and memory work can add evidence without changing the canonical storage contract.
- Product UI must distinguish active, unresolved, and superseded theory elements.
