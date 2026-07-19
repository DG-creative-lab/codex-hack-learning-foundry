# ADR 0006: Evidence-backed understanding-gap signals

Status: accepted for the hackathon MVP

## Context

Cognitive debt is an emerging and incompletely measured phenomenon. Missing explanations, stale theory, unresolved contradictions, weak transfer evidence, and opaque capability revisions can create practical risk, but none of these observations directly measures a person's mind.

Learning Foundry already maintains canonical evidence and separate human, agent, and shared-theory projections. Warning signs should therefore be deterministic derived objects rather than another editable truth store or a synthetic score.

## Decision

Derive bounded `UnderstandingGap` objects from the validated workspace projection. Each gap has a stable kind, qualitative level, affected theory IDs, plain-language rationale, explicit caveat, linked evidence events, and recommended intervention.

The MVP detects:

- decisions without inspectable human explanation evidence;
- stale theory evidence;
- prediction or transfer areas with challenge or no durable usable evidence;
- revised capabilities without evaluation evidence;
- unresolved explicit contradictions;
- declared dependencies represented only by agent-authored theory evidence; and
- mismatches between an explicit micro-world prediction expectation and a separately recorded modeled observation.

Micro-world prediction options declare expected outcome directions against artifact outcome IDs. The detector compares those directions with the transparent renderer's output. Prediction, interaction, and causally linked reflection remain separate evidence references. A linked reflection can lower the qualitative level, but its text is not semantically scored.

Confirmations, dismissals, and annotations append human-interpretation events. They change review state without mutating detector evidence. A gap is reduced only when later canonical evidence changes the underlying condition. Gap IDs include the latest evidence identity so a materially changed signal can reappear after an earlier dismissal.

## Consequences

- No aggregate cognitive-debt or mastery score is produced.
- Every displayed signal has at least one canonical evidence event.
- Missing evidence is described as absence, never inability.
- Modeled outcomes remain model output rather than observed cognition or performance.
- Unrecorded interface exploration cannot create participation or gap evidence.
- The prepared journey exposes a transfer gap that disappears after an inspectable transfer response.
- Learning Foundry can make warning signs visible and help mitigate cognitive debt; it does not claim to solve it.
