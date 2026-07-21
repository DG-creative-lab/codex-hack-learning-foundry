# ADR 0010: Derived prepared-demo journey and reset

## Status

Accepted

## Context

The integrated hackathon demonstration crosses Sources, Understanding, Learn, Memory, and Foundry. A presenter needs one reliable path through those views, but a separate mutable checklist would drift from canonical evidence and could imply that opening a screen proves learning or authorizes a capability.

The same journey must work offline, recover quickly during recording, and preserve the distinction between transient exploration and deliberate evidence.

## Decision

Represent the prepared demonstration as an eight-stage derived projection: source inspection, theory inspection, explainer inspection, micro-world experiment, transfer, capability approval and activation, capability application, and practical-feedback consolidation.

- A typed prepared-demo definition owns every required artifact ID, capability and adapter version, destination, and completion predicate. Missing prepared artifacts fail closed; the journey never falls back to the first item of a matching kind.
- The journey register is persistent across product views and routes each stage through the shared workspace-destination contract.
- Source, theory, and explainer inspection are local session state. They guide presentation but do not enter the evidence ledger.
- Experiment, transfer, capability, application, and revision completion are derived from validated canonical events. A view visit alone cannot complete them.
- Micro-world completion requires a recorded interaction with a reflection linked to that exact interaction. Temporary slider movement is not durable progress.
- Revision completion requires an approved consolidation containing targeted review work, a theory revision, and a capability revision request.
- Restart uses the ledger storage boundary to remove all runtime workspace activity, restore the committed prepared seed, clear local inspection and navigation selections, and return to Understanding. The confirmation explicitly names this destructive scope. If reset persistence fails, existing evidence is retained and the failure is shown.
- Prepared execution remains the canonical demo adapter and only a direct execution from its declared adapter version completes Apply. Live Codex and prepared fallback after a live failure remain optional, inspectable extensions outside canonical demo progress.

## Consequences

- Demo progress cannot promote understanding, capability authority, or revision state independently of domain evidence.
- The complete prepared journey remains deterministic, offline-capable, and recoverable without deleting application files manually.
- The first three check marks reset on reload because they are navigation aids rather than canonical claims.
- Changing the domain sample requires new prepared evidence and destination selection, not a second journey persistence model.
- Automated integration tests can exercise the full path through the same workflows and projections used by the interface.
