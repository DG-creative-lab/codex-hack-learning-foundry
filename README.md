# Learning Foundry

Learning Foundry is a universal, local-first environment where a human and Codex learn from the same approved sources, practical work, and feedback.

Local literature, papers, transcripts, documentation, and online sources enter one provenance-preserving pipeline. The resulting shared knowledge produces adaptive learning artifacts for the human and controlled skills, tools, and eventually plugins for the agent. Application outcomes return as evidence so both learning states can improve.

## Status

Active OpenAI Build Week project. UI value density is the first prepared sample domain, not a product-level restriction.

The current vertical slice includes:

- Approved local text, Markdown, PDF, and HTTPS source capture through one normalized pipeline.
- Reviewable source synthesis into a provenance-preserving Living Theory.
- Source-grounded explainers with learner corrections, confusion flags, and depth requests.
- Recall, explanation, prediction, teach-back, and transfer checks that produce evidence vectors rather than a mastery score.
- A constrained design-density micro-world with prediction, recorded interaction, and reflection evidence.
- An append-only evidence ledger with deterministic human, agent, theory, and capability projections.
- A generated and evaluated `value-density-reviewer` Codex skill with explicit approval and revision states.

## Run locally

```bash
pnpm install
pnpm dev
```

## Verify

```bash
pnpm test
pnpm build
```

## Repository boundaries

Prepared sample evidence is committed. Personal learning memory, imported private sources, credentials, caches, and Electron runtime data are not.

## Documentation

- [Product brief](docs/product/brief.md): product thesis, scope, audience, and hackathon journey.
- [System model](docs/product/system-model.md): plain-English explanation of sources, theory, learning, memory, and capabilities.
- [Interface direction](docs/design/direction.md): target information architecture and visual principles.
- [ADR 0001](docs/architecture/0001-evidence-ledger.md): append-only evidence and derived projections.
- [ADR 0002](docs/architecture/0002-universal-source-pipeline.md): normalized local and online source processing.
- [ADR 0003](docs/architecture/0003-living-theory.md): the shared, revisable theory model.
- [ADR 0004](docs/architecture/0004-learning-artifacts.md): bounded explainers, checks, and micro-worlds.
- [ADR 0005](docs/architecture/0005-distinct-memory-projections.md): separate human, agent, and shared-theory memory projections.
- [Hackathon baseline](docs/hackathon/baseline.md): the repository state at the start of Build Week.
