# ADR 0002: Universal source pipeline with dual projections

Status: accepted for the hackathon MVP

## Context

Learning Foundry is not a design-learning application. Design intelligence is only its first sample workspace. The domain model must support approved literature, papers, studies, transcripts, documentation, online sources, and practical evidence without coupling ingestion to one subject.

## Decision

All sources enter one domain-independent pipeline:

`captured -> checked -> extracted -> fragmented -> synthesized -> ready`

The pipeline produces a shared evidence-backed knowledge layer containing source fragments, claims, knowledge atoms, associations, contradictions, confidence, and derivation records.

Two projections derive from that canonical layer:

1. Human learning: objectives, lessons, exercises, responses, recall, review items, misconceptions, explanations, confidence, and transfer evidence.
2. Agent learning: durable knowledge, assumptions, operating boundaries, evaluations, failures, execution records, and versioned capabilities.

Practical outcomes and user feedback append new evidence to the canonical layer. Consolidation may propose updates to either projection, but it cannot silently activate capabilities or erase provenance.

## Consequences

- Sample-domain concepts cannot appear in core entity names or navigation.
- Source adapters may vary, but must produce the same fragment and provenance contract.
- Human confidence, agent synthesis, source fact, practical observation, and validated behavior remain distinct epistemic classes.
- The design-density sample can be replaced by another source collection without restructuring the application.

## MVP implementation

The desktop boundary supports approved HTTPS pages and local `.txt`, `.md`, `.markdown`, and `.pdf` files. Cheerio extracts meaningful HTML blocks and PDF.js extracts page text. The online adapter rejects credentials, custom ports, loopback hosts, and private-network addresses, follows at most three validated redirects, and limits source size.

Every adapter returns the same extracted-document contract. The domain layer then emits two atomic transitions:

1. `source.synthesis_completed` with an immutable content-addressed source version, normalized fragments, and its reviewable proposal.
2. `theory.synthesis_reviewed` with an explicit human rejection or an approval carrying the accepted elements and relationships from which Living Theory is projected.

The desktop online adapter validates every DNS answer as public and pins the HTTPS connection to the selected validated address while preserving the source hostname for TLS and HTTP. Response bodies are streamed under a hard byte cap, and both DNS and HTTP operations have deadlines.

Source changes produce a new version linked by `previousVersionId`. Candidates at a stable source position revise the previously approved element with a new theory ID; the earlier element remains superseded in the Living Theory projection.

Source workflow commands belong to the application layer. Views may invoke registration, processing, and review commands, but they do not coordinate extraction, synthesis, or evidence-event sequencing themselves.

Raw documents are transient inputs rather than ledger records. A shared runtime-neutral content contract normalizes whitespace, HTML selectors, metadata fallbacks, and persistence limits before evidence is appended. JSONL stores at most 64 normalized units of 1,600 characters for each source version, while the version fingerprint and provenance identify the original extraction. This keeps the MVP on one recoverable persistence mechanism without allowing a source to turn replay into an unbounded document store. A dedicated content-addressed store can be added behind this boundary if full-text retrieval becomes a product requirement.
