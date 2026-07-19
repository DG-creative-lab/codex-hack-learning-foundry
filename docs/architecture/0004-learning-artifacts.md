# ADR 0004: Bounded learning artifacts with append-only participation evidence

Status: accepted for the hackathon MVP

## Context

Summaries and completion states can create familiarity without showing whether knowledge is available for action. Learning Foundry needs explanations, varied checks, and interactive environments that remain grounded in approved sources and the Living Theory.

Generated learning material also crosses a trust boundary. Unbounded payloads can make ledger replay expensive, arbitrary generated code is unsafe, and mutable learner state would weaken provenance.

## Decision

Represent each learning artifact as a bounded, runtime-validated contract registered through an agent-synthesis evidence event. Record learner feedback and participation as separate append-only events rather than mutating the registered artifact.

The learning layer contains three artifact families:

1. Source-grounded explainers order background, purpose, intuition, mechanism, details, and assumptions around an active project. Factual sections declare source and fragment provenance, while synthesized interpretation remains visibly distinct.
2. Understanding checks cover recall, explanation, prediction, teach-back, and transfer. Responses, evaluations, disputes, and future-check preferences are separate events. Projection produces evidence vectors rather than a universal mastery score.
3. Micro-worlds declare purpose, variables, controls, outcomes, provenance, assumptions, limitations, prediction options, and reflection prompts. They select a trusted renderer from a registry and cannot contain executable JavaScript.

Application commands accept stable artifact IDs and learner input, then resolve the canonical projected artifact before validating and appending an event. Views do not supply canonical artifact state.

Micro-world evaluation and rendering use separate registries with the same renderer identity. The domain registry owns required variable roles, outcome kinds, and deterministic evaluation. The view registry maps that identity to a trusted React stage. Adding another micro-world category requires an explicit implementation in both registries.

The micro-world learning sequence is prediction, outcome reveal, recorded interaction, and interaction-linked reflection. Temporary control changes remain local UI state. A recorded interaction includes the complete variable snapshot, the variables changed since the previous recorded state, and deterministic outcome values.

## Projection invariants

- Artifact, check, attempt, interaction, and feedback identifiers are stable and validated.
- Payload strings and collections have practical maximums before entering JSONL.
- Factual explainer sections retain fragment-level provenance.
- Section dependencies belong to the artifact's declared source and theory manifests.
- Recall evidence alone cannot represent full understanding.
- Disputed evaluations no longer contribute provisional signals.
- A micro-world interaction requires a prior prediction.
- Recorded outcome values must match deterministic reevaluation during replay.
- A reflection identifies the exact recorded interaction it interprets.
- Unrecorded control changes do not become evidence.

## Consequences

- Learning artifacts remain inspectable, replayable, and safe to store in the ledger.
- The learner can correct generated interpretation without altering source evidence.
- Human participation can later contribute to understanding-gap and consolidation projections through stable evidence IDs.
- Trusted renderers limit creative freedom to explicitly implemented interaction models; this is intentional for the MVP.
- A future artifact generator must target an existing bounded contract or introduce a reviewed renderer implementation.
