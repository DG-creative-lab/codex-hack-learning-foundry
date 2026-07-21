# OpenAI Build Week submission worksheet

This document is the source of truth for the Devpost submission.

## Project overview

**Project name**

Learning Foundry

**Elevator pitch**

A local-first shared understanding environment that turns approved sources and practical feedback into traceable human learning and approval-gated Codex capabilities.

**Category**

Education

## Project story

### Inspiration

AI can increase production velocity faster than people can build and maintain the mental models needed to participate. The problem is not simply remembering more. Human confidence, source-backed knowledge, agent synthesis, and validated behavior are different epistemic states, yet most tools collapse them into chat history, a completion mark, or a mastery score.

Learning Foundry makes those differences inspectable. It creates an environment where a person and an agent learn from the same approved evidence while retaining distinct learning states.

### What it does

Learning Foundry accepts local and approved online sources through one provenance-preserving pipeline. It synthesizes them into a revisable Living Theory of concepts, claims, relationships, assumptions, boundaries, decisions, contradictions, and open questions.

The same theory generates source-grounded explainers, varied understanding checks, transfer tasks, and constrained interactive micro-worlds for the human. It also grounds versioned Codex capabilities with explicit boundaries, evaluations, failures, and approval gates.

Practical results return as append-only evidence. A correction can create targeted human review, a theory revision proposal, and a structured capability revision request without overwriting the original source, silently changing memory, or activating a skill.

### How we built it

The desktop application uses Electron, React, TypeScript, Vite, Zod, and an append-only JSONL evidence ledger. Canonical events are replayed into separate human-memory, agent-memory, shared-theory, understanding-gap, source, learning, and capability projections. Every generated artifact and consequential decision retains provenance.

The prepared design-density journey is committed sample data and runs offline. A constrained micro-world lets the learner predict, manipulate spacing, hierarchy, and visible information, then record an observation and reflection as separate evidence. A prepared execution adapter keeps the demonstration deterministic; an optional live Codex adapter requires explicit consent and records its bounded prompt context and fallback behavior.

### How we used Codex and GPT-5.6

We built the project collaboratively in Codex with GPT-5.6. Codex helped turn the initial product thesis into a sequenced issue map, implement each vertical slice, maintain architecture decisions, and run the verification loop. Pull-request findings became focused regression tests and fixes covering atomic ledger transitions, provenance, network and IPC boundaries, accessibility, state retention, deterministic replay, approval gates, and prepared-demo identity.

Human judgment remained responsible for product direction, interaction design, epistemic boundaries, review decisions, and what entered the canonical evidence model. This collaboration is also the product thesis: agents can accelerate implementation while the environment keeps rationale, evidence, uncertainty, and participation visible to the human.

### Challenges

The hardest problem was preserving meaning across the complete loop. It was easy to make each screen work independently; it was harder to ensure that a prediction, interaction, reflection, capability execution, and correction remained distinct, traceable events whose projections could be replayed deterministically.

We also had to resist false precision. Learning Foundry exposes qualitative, evidence-backed understanding gaps, but it does not claim to measure cognition or solve cognitive debt.

### What we learned

Shared context is not shared understanding. A useful human-agent system needs stable identifiers, inspectable provenance, explicit epistemic states, and practical evidence that can challenge both learning material and agent behavior. Dynamic learning media is valuable when it reveals a causal relationship, not when it merely adds interaction.

### What's next

The current design-density workspace proves a domain-independent contract. Next steps include additional bounded micro-world renderers, richer source extractors, user-authored consolidation policies, and generated tools or plugins that use the same evaluation and approval lifecycle.

## Built with tags

TypeScript, React, Electron, Vite, Vitest, Zod, pnpm, Codex, GPT-5.6, Playwright

## Links

**Repository**

https://github.com/DG-creative-lab/codex-hack-learning-foundry

**Public YouTube demo**

https://youtu.be/oChkrpML01U

## Judge testing instructions

Tested platform: macOS with Node.js 22+ and pnpm 11.

```bash
git clone https://github.com/DG-creative-lab/codex-hack-learning-foundry.git
cd codex-hack-learning-foundry
corepack enable
pnpm install
pnpm dev
```

No credentials are needed. In the application, use **Restart prepared journey**, then follow the journey bar from Source through Revise. Keep the **Prepared** adapter selected in Foundry. The browser fallback is `pnpm dev:web`.

Verification commands:

```bash
pnpm lint
pnpm test
pnpm build
```

## Additional information

**Submitter type:** Individual

**Country of residence:** Confirm in Devpost before saving.

**Codex `/feedback` session ID:**

`d019f60df-4180-73f2-b6ca-f5463870b2aa`

## Media checklist

- Thumbnail: 3:2 image with the Understanding workspace and readable Learning Foundry identity.
- Gallery 1: Living Theory with source context.
- Gallery 2: micro-world after recorded prediction and observation.
- Gallery 3: capability approval or consolidation revision output.
- Video: public YouTube, under three minutes, with audible explanation of both Codex and GPT-5.6 use.

## Final checklist

- [x] Confirm the repository has an explicit MIT license.
- [ ] Confirm README rendering and setup from a clean checkout.
- [x] Record, review, and publicly upload the under-three-minute demo.
- [x] Run `/feedback` in the majority-build Codex task and record the returned session ID.
- [ ] Complete Project overview, Project details, and Additional info in Devpost.
- [ ] Select Education and verify country and submitter type.
- [ ] Preview the public project page and test every link.
- [ ] Accept the official rules personally.
- [ ] Submit before the deadline and verify the project no longer says Draft.
