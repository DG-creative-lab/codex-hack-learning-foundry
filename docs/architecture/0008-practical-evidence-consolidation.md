# ADR 0008: Human-gated practical evidence consolidation

## Status

Accepted

## Context

Source synthesis and capability evaluation establish a prepared model, but practical use can reveal missing boundaries, incorrect interpretations, and behavior that does not transfer. Updating projections directly from a result would erase the distinction between observation, generated revision, and human judgment. Ignoring practical feedback would prevent the system from learning from use.

## Decision

Practical use and consolidation are separate append-only transitions.

- An active capability application records its exact capability ID and version, input, observed output, outcome, linked theory elements, and source provenance.
- Human observation, correction, failure, and participation events reference an eligible prior application, micro-world interaction, or linked reflection.
- Consolidation is an explicit deterministic command over selected trigger-event IDs. It may propose targeted review items, new theory-element versions, and structured capability revision requests.
- The canonical consolidation projector resolves every trigger, rejects ineligible events, recomputes the expected proposal, and compares it with the submitted payload. Living Theory and learning projections consume only this validated projection rather than interpreting consolidation events independently.
- A proposal is inspectable but inert. It cannot mutate theory, activate a capability, supersede a version, or delete evidence.
- A separate human review accepts or rejects the whole bounded proposal with a rationale. Approval projects theory revisions and accepts capability revision requests; rejection retains the proposal, removes its provisional review work, and releases its trigger evidence for reconsideration.
- A theory revision has a new stable ID, references `revisesElementId`, and retains predecessor and trigger evidence. A capability revision request identifies the exact capability version, requested behavioral change, and evidence, but cannot become an executable manifest until a materially revised artifact and new evaluation cases are registered.
- Targeted review items are narrowed to the selected check's theory scope and retain every trigger event ID.
- Replaying the same ordered ledger produces the same practical evidence, proposal, theory, learning, memory, and capability projections.

## Consequences

- Practical failures and corrections remain visible even after a later revision succeeds.
- Agent outcomes do not imply human understanding, and human feedback does not become source fact.
- Targeted follow-up learning can appear before a revision is approved without mutating the original learning artifact.
- Consolidation requires deliberate user action and review; no background process can silently change authority.
- Accepted capability requests create work for a later artifact revision workflow; they cannot be approved or activated as capabilities themselves.
- Proposal approval is intentionally coarse for the hackathon. A future version may support per-output decisions while preserving the same canonical event boundary.
