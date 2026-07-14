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
