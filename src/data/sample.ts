import type { DensityPrinciple, EvaluationCase, EvidenceEvent } from "../domain/types";

export const source = {
  id: "source-ui-density-2024",
  title: "UI Density",
  author: "Matthew Ström-Awn",
  published: "20 May 2024",
  url: "https://mattstromawn.com/writing/ui-density/",
  licenseNote: "Linked primary source. Repository stores attribution and concise derived notes, not the article text.",
  thesis: "Density is the value a user gets from an interface divided by the time and space the interface occupies."
};

export const principles: DensityPrinciple[] = [
  {
    id: "visual-density",
    index: "01",
    title: "Visual",
    definition: "How much appears within the available space. A fast perception, not a quality judgment.",
    question: "What does the interface feel full of?",
    sourceRef: "Visual density"
  },
  {
    id: "information-density",
    index: "02",
    title: "Information",
    definition: "How much of what is shown communicates useful information rather than decoration.",
    question: "Which marks carry information?",
    sourceRef: "Information density"
  },
  {
    id: "meaning-density",
    index: "03",
    title: "Meaning",
    definition: "How arrangement, similarity, and proximity help people understand relationships.",
    question: "Does arrangement explain the system?",
    sourceRef: "Design density"
  },
  {
    id: "time-density",
    index: "04",
    title: "Time",
    definition: "How quickly a person can reach, interpret, and act on useful information.",
    question: "What time does the interface ask for?",
    sourceRef: "Density in time"
  },
  {
    id: "value-density",
    index: "05",
    title: "Value",
    definition: "The useful outcome achieved relative to the time, space, and attention requested.",
    question: "What becomes possible for this user?",
    sourceRef: "Density in value"
  }
];

export const seedEvents: EvidenceEvent[] = [
  {
    id: "evt-source-001",
    type: "source.imported",
    kind: "source_fact",
    createdAt: "2026-07-14T10:00:00.000Z",
    actor: "system",
    summary: "Primary source registered with author, publication date, and URL.",
    sourceIds: [source.id],
    payload: { title: source.title, url: source.url }
  },
  {
    id: "evt-synthesis-001",
    type: "module.synthesized",
    kind: "agent_synthesis",
    createdAt: "2026-07-14T10:01:00.000Z",
    actor: "agent",
    summary: "Five density lenses synthesized into a transferable review method.",
    sourceIds: [source.id],
    payload: { principleIds: principles.map((principle) => principle.id) }
  }
];

export const evaluationCases: EvaluationCase[] = [
  {
    id: "eval-audience",
    title: "Audience changes the answer",
    premise: "The same operations console is reviewed for a novice and an expert.",
    expectation: "Recommendations adapt to expertise instead of enforcing one density level.",
    status: "passed",
    evidence: "Both reviews name the user and produce materially different hierarchy recommendations."
  },
  {
    id: "eval-whitespace",
    title: "Whitespace is not waste",
    premise: "A sparse screen uses proximity to communicate groups.",
    expectation: "The skill preserves meaningful space while removing uninformative space.",
    status: "passed",
    evidence: "The review identifies grouping as meaning-bearing and leaves it intact."
  },
  {
    id: "eval-time",
    title: "Workflow time counts",
    premise: "A visually calm task requires five avoidable confirmation steps.",
    expectation: "The skill diagnoses low time density despite low visual density.",
    status: "passed",
    evidence: "The output prioritizes removal of two confirmations over visual compression."
  },
  {
    id: "eval-access",
    title: "Constraints survive",
    premise: "Compact controls would reduce pointer target size and legibility.",
    expectation: "The skill refuses density changes that violate declared constraints.",
    status: "passed",
    evidence: "Minimum target size and readable type remain explicit boundaries."
  }
];

