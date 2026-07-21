# ADR 0009: Optional live Codex capability execution

## Status

Accepted

## Context

The prepared journey must remain deterministic and usable without a network, credentials, or model availability. A bounded live path is still useful for showing that an approved capability can operate on a new task. Treating those paths as the same opaque action would hide consent, failures, fallback, and the context sent outside the application.

## Decision

Capability execution uses a small adapter contract with `prepared` and `live_codex` implementations.

- Prepared execution is the default and the only adapter used by automated tests.
- Live Codex is selected explicitly for one execution and requires a fresh consent checkbox before invocation.
- The renderer sends only consent, capability identity and version, its declared skill path, and task input. It cannot provide prompt text, context labels, provenance assertions, excluded-context claims, a command, working directory, environment, or credential.
- Electron requires the exact `skills/<capability-id>` path, reads the packaged `SKILL.md` under the trusted application root, and constructs the canonical prompt boundary itself. Missing or mismatched artifacts fail recoverably before Codex starts.
- Electron starts one quiet Codex CLI request with project instructions disabled, response storage disabled, command approval left in suggest mode, an empty dedicated working directory, a one-minute deadline, and an output cap.
- The main-process prompt boundary records the instruction, trusted capability artifact, and explicitly excluded context. API credentials, private desktop activity, unapproved sources, and canonical ledger contents are excluded.
- One application event records the requested adapter, completed adapter, capability version, input provenance, prompt boundary, timing, adapter version, and every attempt.
- A recoverable live failure runs the prepared adapter and appends the failed live attempt and successful fallback atomically. No partial execution event is appended before fallback completes.
- Raw CLI stderr and secrets never enter the ledger. Authentication and runtime failures are mapped to bounded recoverable error codes and safe messages.

## Consequences

- The demo remains reliable offline while making live execution inspectable when available.
- A live result cannot be mistaken for the deterministic prepared result, and fallback remains visible rather than silently changing adapters.
- Capability execution remains deliberate and versioned; it does not create an autonomous Codex session or activate a capability.
- The current CLI integration favors compatibility with the installed one-shot interface. A future API-backed adapter can implement the same application contract without changing canonical evidence.
