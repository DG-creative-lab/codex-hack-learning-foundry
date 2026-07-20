# ADR 0007: Evidence-gated capability activation

## Status

Accepted

## Context

A generated capability can pass technical checks while its rationale, operating boundaries, or relevance remain opaque to the human. Treating synthesis or evaluation as activation would collapse agent output, validated behavior, and human authorization into one state.

## Decision

Capability state is a deterministic projection of append-only events with six explicit states: `draft`, `evaluated`, `approved`, `active`, `rejected`, and `superseded`.

- Registration records a draft manifest with source coverage, theory links, assumptions, boundaries, declared evaluation cases, and a bounded activation policy.
- Evaluation records a result for every declared case. Re-evaluation appends a run to the inspectable history; the latest run informs the gate without erasing earlier failures. Evaluation cannot approve or activate the capability.
- Approval or rejection is a human-authored decision that cites the exact gate evidence inspected at that point in the ledger.
- Activation is a second explicit human event referencing the approval event.
- Rejection records an actionable revision request. A revision is a new capability version and does not mutate the rejected version.
- Supersession is explicit and valid only when the replacement was registered as a revision of the prior capability.

The gate derives source, boundary, evaluation, understanding, and approval requirements. Risk policy may lighten the understanding requirement, but never removes explicit human approval. The design-density demo requires a completed prediction or transfer attempt before approval.

## Consequences

- Agent synthesis, technical success, human understanding, and authorization remain separate epistemic states.
- Every status can be rebuilt and explained from canonical events.
- Failed gates and rejected decisions remain inspectable revision evidence.
- Activation takes two human actions by design: approval records judgment; activation grants authority.
- Future risk policies can tune bounded requirements without introducing autonomous activation.
