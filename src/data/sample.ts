import type { LivingTheoryMetadata } from "../domain/livingTheory";
import { approvalEvents, createSynthesisProposal, normalizeExtractedDocument } from "../domain/sourcePipeline";
import type { DensityPrinciple, EvaluationCase, EvidenceEvent } from "../domain/types";
import { capabilities, learningArtifacts, workspaceSources } from "./workspace";

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

export const designDensityTheoryMetadata: LivingTheoryMetadata = {
  id: "theory-design-density",
  title: "Design density",
  summary:
    "A source-grounded theory for evaluating interface density by user value, time, space, meaning, and constraints.",
  sourceIds: ["source-ui-density-2024", "source-dense-by-design", "source-wcag-target-size"]
};

const preparedTranscriptExtraction = normalizeExtractedDocument(
  "source-dense-by-design",
  {
    title: "Dense by Design",
    author: "Matthew Ström-Awn / Config 2026",
    format: "Prepared transcript",
    fingerprint: "1".repeat(64),
    units: [
      {
        content: "Value per second per pixel. That is what we're really after.",
        location: { kind: "transcript", label: "17:38-17:42" }
      }
    ]
  },
  "2026-07-14T10:00:10.000Z"
);

const generatedTranscriptProposal = createSynthesisProposal(
  "source-dense-by-design",
  preparedTranscriptExtraction.version,
  preparedTranscriptExtraction.fragments,
  "synthesis-dense-by-design-prepared",
  "2026-07-14T10:00:15.000Z"
);
const preparedTranscriptProposal = {
  ...generatedTranscriptProposal,
  elements: generatedTranscriptProposal.elements.map((candidate) => ({
    ...candidate,
    element: { ...candidate.element, kind: "claim" as const }
  }))
};

const preparedTranscriptEvents: EvidenceEvent[] = [
  {
    id: "evt-source-dense-by-design-extracted",
    type: "source.processing_completed",
    kind: "practical_observation",
    createdAt: "2026-07-14T10:00:10.000Z",
    actor: "system",
    summary: "Prepared transcript fragment normalized with timestamp provenance.",
    sourceIds: ["source-dense-by-design"],
    payload: {
      sourceId: "source-dense-by-design",
      author: "Matthew Ström-Awn / Config 2026",
      outputs: { atoms: 9, lessons: 1, capabilities: 1 },
      version: preparedTranscriptExtraction.version,
      fragments: preparedTranscriptExtraction.fragments
    }
  },
  {
    id: "evt-synthesis-dense-by-design-proposed",
    type: "theory.synthesis_proposed",
    kind: "agent_synthesis",
    createdAt: "2026-07-14T10:00:15.000Z",
    actor: "agent",
    summary: "Prepared a traceable transcript claim for review.",
    sourceIds: ["source-dense-by-design"],
    payload: { proposal: preparedTranscriptProposal }
  },
  ...approvalEvents(preparedTranscriptProposal, "2026-07-14T10:00:20.000Z")
];

function learningSeedEvents(): EvidenceEvent[] {
  return learningArtifacts.map((artifact, index) => ({
    id: `evt-learning-${String(index + 1).padStart(3, "0")}`,
    type: "learning.artifact_registered",
    kind: "agent_synthesis",
    createdAt: `2026-07-14T11:00:0${index}.000Z`,
    actor: "agent",
    summary: `${artifact.title} registered as a human learning artifact.`,
    sourceIds: artifact.sourceIds,
    payload: { artifact }
  }));
}

function capabilitySeedEvents(): EvidenceEvent[] {
  return capabilities.flatMap(({ manifest, evaluation, executions }, index) => {
    const createdAt = `2026-07-14T11:01:0${index}.000Z`;
    const events: EvidenceEvent[] = [
      {
        id: `evt-capability-${String(index + 1).padStart(3, "0")}`,
        type: "capability.registered",
        kind: "agent_synthesis",
        createdAt,
        actor: "agent",
        summary: `${manifest.name} registered as a controlled capability manifest.`,
        sourceIds: manifest.sourceIds,
        payload: { manifest }
      }
    ];

    if (evaluation) {
      events.push({
        id: `evt-capability-evaluation-${String(index + 1).padStart(3, "0")}`,
        type: "capability.evaluation_recorded",
        kind: "validated_behavior",
        createdAt,
        actor: "system",
        summary: `${manifest.name} passed ${evaluation.passed} of ${evaluation.total} evaluation checks.`,
        sourceIds: manifest.sourceIds,
        payload: { capabilityId: manifest.id, evaluation }
      });
    }

    for (let execution = 0; execution < executions; execution += 1) {
      events.push({
        id: `evt-capability-execution-${String(index + 1).padStart(3, "0")}-${execution + 1}`,
        type: "capability.executed",
        kind: "practical_observation",
        createdAt,
        actor: "system",
        summary: `${manifest.name} execution recorded.`,
        sourceIds: manifest.sourceIds,
        payload: { capabilityId: manifest.id }
      });
    }

    return events;
  });
}

export const seedEvents: EvidenceEvent[] = [
  ...workspaceSources.map(
    (workspaceSource, index): EvidenceEvent => ({
      id: `evt-source-${String(index + 1).padStart(3, "0")}`,
      type: "source.registered",
      kind: "source_fact",
      createdAt: `2026-07-14T10:00:0${index}.000Z`,
      actor: "system",
      summary: `${workspaceSource.title} registered with provenance metadata.`,
      sourceIds: [workspaceSource.id],
      payload: { source: workspaceSource }
    })
  ),
  {
    id: "evt-workspace-configuration-001",
    type: "workspace.configured",
    kind: "user_interpretation",
    createdAt: "2026-07-14T10:00:30.000Z",
    actor: "human",
    summary: "Configured the source-grounded design-density workspace.",
    sourceIds: designDensityTheoryMetadata.sourceIds,
    payload: { theory: designDensityTheoryMetadata }
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
  },
  {
    id: "evt-theory-purpose-001",
    type: "theory.element_recorded",
    kind: "agent_synthesis",
    createdAt: "2026-07-14T10:02:00.000Z",
    actor: "agent",
    summary: "Recorded the practical purpose of the design-density theory.",
    sourceIds: [source.id],
    payload: {
      element: {
        id: "theory-purpose-review-value",
        kind: "purpose",
        title: "Review for user value",
        statement:
          "Evaluate interface density by the useful outcome achieved for a specific user, not by compactness alone.",
        epistemicKind: "agent_synthesis",
        status: "active",
        sourceIds: [source.id],
        evidenceEventIds: []
      }
    }
  },
  ...principles.map(
    (principle, index): EvidenceEvent => ({
      id: `evt-theory-concept-${String(index + 1).padStart(3, "0")}`,
      type: "theory.element_recorded",
      kind: "source_fact",
      createdAt: `2026-07-14T10:0${index + 3}:00.000Z`,
      actor: "system",
      summary: `Recorded the ${principle.title.toLowerCase()} density concept.`,
      sourceIds: [source.id],
      payload: {
        element: {
          id: `theory-concept-${principle.id}`,
          kind: "concept",
          title: `${principle.title} density`,
          statement: principle.definition,
          epistemicKind: "source_fact",
          status: "active",
          sourceIds: [source.id],
          evidenceEventIds: []
        }
      }
    })
  ),
  {
    id: "evt-theory-boundary-001",
    type: "theory.element_recorded",
    kind: "validated_behavior",
    createdAt: "2026-07-14T10:08:00.000Z",
    actor: "system",
    summary: "Recorded an accessibility boundary on density changes.",
    sourceIds: ["source-wcag-target-size"],
    payload: {
      element: {
        id: "theory-boundary-accessibility",
        kind: "boundary",
        title: "Accessibility constraints survive",
        statement: "Density changes must preserve declared target-size and legibility constraints.",
        epistemicKind: "validated_behavior",
        status: "active",
        sourceIds: ["source-wcag-target-size"],
        evidenceEventIds: []
      }
    }
  },
  {
    id: "evt-theory-question-001",
    type: "theory.element_recorded",
    kind: "hypothesis",
    createdAt: "2026-07-14T10:09:00.000Z",
    actor: "human",
    summary: "Recorded an unresolved transfer question.",
    sourceIds: [],
    payload: {
      element: {
        id: "theory-question-audience",
        kind: "question",
        title: "How does expertise change the recommendation?",
        statement: "The appropriate density may differ materially between novice and expert workflows.",
        epistemicKind: "hypothesis",
        status: "unresolved",
        sourceIds: [],
        evidenceEventIds: []
      }
    }
  },
  {
    id: "evt-theory-relationship-001",
    type: "theory.relationship_recorded",
    kind: "agent_synthesis",
    createdAt: "2026-07-14T10:10:00.000Z",
    actor: "agent",
    summary: "Linked the value-density purpose to its accessibility boundary.",
    sourceIds: [source.id, "source-wcag-target-size"],
    payload: {
      relationship: {
        id: "theory-relation-purpose-accessibility",
        kind: "constrained-by",
        fromElementId: "theory-purpose-review-value",
        toElementId: "theory-boundary-accessibility",
        sourceIds: [source.id, "source-wcag-target-size"],
        evidenceEventIds: []
      }
    }
  },
  ...learningSeedEvents(),
  ...capabilitySeedEvents(),
  ...preparedTranscriptEvents
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
