# Learning Foundry

Learning Foundry is a universal, local-first environment where a human and Codex learn from the same approved sources, practical work, and feedback.

Local literature, papers, transcripts, documentation, and online sources enter one provenance-preserving pipeline. The resulting shared knowledge produces adaptive learning artifacts for the human and controlled skills, tools, and eventually plugins for the agent. Application outcomes return as evidence so both learning states can improve.

## Status

OpenAI Build Week hackathon project with a complete, resettable prepared vertical slice. UI value density is the first sample domain, not a product-level restriction.

The current vertical slice includes:

- Approved local text, Markdown, PDF, and HTTPS source capture through one normalized pipeline.
- Reviewable source synthesis into a provenance-preserving Living Theory.
- Source-grounded explainers with learner corrections, confusion flags, and depth requests.
- Recall, explanation, prediction, teach-back, and transfer checks that produce evidence vectors rather than a mastery score.
- A constrained design-density micro-world with prediction, recorded interaction, and reflection evidence.
- An append-only evidence ledger with deterministic human, agent, theory, and capability projections.
- Evidence-backed understanding-gap signals with qualitative rationale, review actions, and recommended interventions rather than a cognitive-debt score.
- A generated and evaluated `value-density-reviewer` Codex skill with explicit approval and revision states.
- A resettable prepared journey from source inspection through human learning, capability application, and traceable revision.
- An optional, explicitly consented live Codex execution adapter with deterministic prepared fallback.

## Run locally

### Requirements

- Node.js 22 or later.
- pnpm 11 (`corepack enable` can provide the repository-pinned version).
- macOS is the tested Electron platform for the hackathon build. The browser renderer also runs through the platform-independent web development command below.

### Electron application

```bash
corepack enable
pnpm install
pnpm dev
```

The application starts with committed sample data and uses the deterministic **Prepared** execution adapter by default. It requires no API key, network connection, or private source material. Use **Restart prepared journey** in the journey bar to restore the sample state; the confirmation accurately warns that this clears all locally recorded runtime activity.

### Browser fallback

```bash
pnpm dev:web
```

Open the printed local URL. Source-file selection and live Codex execution require Electron, but the complete prepared judge journey works in this browser fallback.

## Judge path

The shortest complete route is documented in the [design-density demo guide](docs/hackathon/design-density-demo.md). It moves through approved sources, the Living Theory, an explainer, prediction and micro-world evidence, transfer, capability approval and prepared application, then a correction that proposes human, theory, and capability revisions.

The optional live Codex adapter is deliberately excluded from the canonical judge path. It requires explicit selection and fresh consent, records the bounded prompt context, and falls back visibly to the prepared adapter when unavailable.

## Built with Codex and GPT-5.6

Learning Foundry was designed and implemented collaboratively in Codex during OpenAI Build Week using GPT-5.6. Codex accelerated the work across the full engineering loop:

- translating the product thesis into issues, bounded domain contracts, and architecture decisions;
- implementing the Electron, React, TypeScript, Zod, and append-only projection layers;
- generating focused regression tests from review findings and repairing security, provenance, accessibility, and state-transition defects;
- running lint, schema, unit, build, and Playwright visual checks; and
- maintaining the demo, system-model, and architecture documentation as the implementation evolved.

The key decisions were human-directed: sources remain canonical; human understanding, agent memory, and shared theory remain separate projections; generated capabilities cannot activate without explicit approval; and the offline prepared journey remains the reliable demonstration while live Codex execution is optional.

## Verify

```bash
pnpm lint
pnpm test
pnpm build
```

The test suite uses only the prepared adapter and does not call an external model or service.

## Repository boundaries

Prepared sample evidence is committed. Personal learning memory, imported private sources, credentials, caches, and Electron runtime data are not.

## License

Learning Foundry is available under the [MIT License](LICENSE).

## Documentation

- [Product brief](docs/product/brief.md): product thesis, scope, audience, and hackathon journey.
- [System model](docs/product/system-model.md): plain-English explanation of sources, theory, learning, memory, and capabilities.
- [Interface direction](docs/design/direction.md): target information architecture and visual principles.
- [ADR 0001](docs/architecture/0001-evidence-ledger.md): append-only evidence and derived projections.
- [ADR 0002](docs/architecture/0002-universal-source-pipeline.md): normalized local and online source processing.
- [ADR 0003](docs/architecture/0003-living-theory.md): the shared, revisable theory model.
- [ADR 0004](docs/architecture/0004-learning-artifacts.md): bounded explainers, checks, and micro-worlds.
- [ADR 0005](docs/architecture/0005-distinct-memory-projections.md): separate human, agent, and shared-theory memory projections.
- [ADR 0006](docs/architecture/0006-evidence-backed-understanding-gaps.md): bounded cognitive-debt warning signals and append-only review state.
- [ADR 0007](docs/architecture/0007-capability-activation-gates.md): explicit, evidence-gated capability approval and activation.
- [ADR 0008](docs/architecture/0008-practical-evidence-consolidation.md): human-reviewed consolidation of practical feedback.
- [ADR 0009](docs/architecture/0009-optional-live-codex-execution.md): prepared and consent-gated live capability execution.
- [ADR 0010](docs/architecture/0010-prepared-demo-journey.md): derived demo progress, durable evidence, and reset behavior.
- [Hackathon baseline](docs/hackathon/baseline.md): the repository state at the start of Build Week.
- [Design-density demo](docs/hackathon/design-density-demo.md): under-three-minute recording script, extended rehearsal, prepared inputs, and recovery checklist.
- [Submission worksheet](docs/hackathon/submission.md): Devpost copy, recording plan, judge instructions, and final submission checklist.
