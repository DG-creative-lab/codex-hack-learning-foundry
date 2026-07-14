# Learning Foundry

Learning Foundry is a universal, local-first environment where a human and Codex learn from the same approved sources, practical work, and feedback.

Local literature, papers, transcripts, documentation, and online sources enter one provenance-preserving pipeline. The resulting shared knowledge produces adaptive learning artifacts for the human and controlled skills, tools, and eventually plugins for the agent. Application outcomes return as evidence so both learning states can improve.

## Status

Active OpenAI Build Week project. UI value density is the first prepared sample domain, not a product-level restriction.

The current vertical slice includes:

- Local and URL source capture.
- A visible source-to-knowledge processing pipeline.
- Separate human-learning and agent-capability projections.
- An append-only evidence ledger.
- A generated and evaluated `value-density-reviewer` Codex skill.
- Explicit capability approval and revision states.

## Run locally

```bash
npm install
npm run dev
```

## Verify

```bash
npm test
npm run build
```

## Repository boundaries

Prepared sample evidence is committed. Personal learning memory, imported private sources, credentials, caches, and Electron runtime data are not.

See [the product brief](docs/product/brief.md), [the memory architecture decision](docs/architecture/0001-evidence-ledger.md), [the universal pipeline decision](docs/architecture/0002-universal-source-pipeline.md), and [the hackathon baseline](docs/hackathon/baseline.md).
