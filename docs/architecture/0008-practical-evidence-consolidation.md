# ADR 0008: Human-gated practical evidence consolidation

## Status

Accepted

## Context

Source synthesis and capability evaluation establish a prepared model, but practical use can reveal missing boundaries, incorrect interpretations, and behavior that does not transfer. Updating projections directly from a result would erase the distinction between observation, generated revision, and human judgment. Ignoring practical feedback would prevent the system from learning from use.

## Decision

Practical use and consolidation are separate append-only transitions.

- An active capability application records its exact capability ID and version, input, observed output, outcome, linked theory elements, and source provenance.
- Human observation, correction, failure, and participation events reference an eligible prior application, micro-world interaction, or linked reflection.
- Consolidation is an explicit deterministic command over selected trigger-event IDs. It may propose targeted review items, new theory-element versions, and draft capability versions.
- A proposal is inspectable but inert. It cannot mutate theory, activate a capability, supersede a version, or delete evidence.
- A separate human review accepts or rejects the whole bounded proposal with a rationale. Approval projects theory revisions and draft capability revisions; rejection retains the proposal and removes its provisional review work.
- A theory revision has a new stable ID, references `revisesElementId`, and retains predecessor and trigger evidence. A capability revision has a new ID and version, references `supersedesCapabilityId`, and starts in `draft`.
- Replaying the same ordered ledger produces the same practical evidence, proposal, theory, learning, memory, and capability projections.

## Consequences

- Practical failures and corrections remain visible even after a later revision succeeds.
- Agent outcomes do not imply human understanding, and human feedback does not become source fact.
- Targeted follow-up learning can appear before a revision is approved without mutating the original learning artifact.
- Consolidation requires deliberate user action and review; no background process can silently change authority.
- Proposal approval is intentionally coarse for the hackathon. A future version may support per-output decisions while preserving the same canonical event boundary.
