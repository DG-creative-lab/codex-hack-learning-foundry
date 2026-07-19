import { explainerArtifactSchema } from "../domain/explainer";
import { deriveLivingTheory, type LivingTheoryMetadata } from "../domain/livingTheory";
import { microWorldArtifactSchema } from "../domain/microWorld";
import { createSynthesisProposal, normalizeExtractedDocument, proposalReviewEvent } from "../domain/sourcePipeline";
import type { DensityPrinciple, EvaluationCase, EvidenceEvent } from "../domain/types";
import { generateUnderstandingChecks } from "../domain/understandingCheckGeneration";
import { understandingEvaluationSchema } from "../domain/understandingChecks";
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

export const preparedExplainer = explainerArtifactSchema.parse({
  id: "explainer-value-density",
  title: "Density is a value equation",
  objective: "Build a working model of density before diagnosing an unfamiliar operational interface.",
  projectContext:
    "Apply the model to Learning Foundry itself: preserve useful context for repeated work while reducing avoidable time and attention.",
  sourceIds: ["source-ui-density-2024", "source-dense-by-design", "source-wcag-target-size"],
  theoryElementIds: [
    "theory-purpose-review-value",
    "theory-concept-visual-density",
    "theory-concept-information-density",
    "theory-concept-meaning-density",
    "theory-concept-time-density",
    "theory-concept-value-density",
    "theory-boundary-accessibility"
  ],
  sections: [
    {
      id: "explainer-density-background",
      kind: "background",
      title: "Start with the outcome, not the amount",
      content:
        "Interfaces are often called dense because they look busy. That description is incomplete: it says how much is visible, but not whether the visible material helps a person decide or act.",
      epistemicKind: "agent_synthesis",
      sourceIds: ["source-ui-density-2024", "source-dense-by-design"],
      fragmentIds: [preparedTranscriptExtraction.fragments[0].id],
      theoryElementIds: ["theory-concept-visual-density", "theory-concept-information-density"]
    },
    {
      id: "explainer-density-purpose",
      kind: "purpose",
      title: "Review for situated user value",
      content:
        "The model gives this project a decision rule: keep information that improves the active workflow, compress friction that does not, and name the user before judging either choice.",
      epistemicKind: "agent_synthesis",
      sourceIds: ["source-ui-density-2024"],
      fragmentIds: [],
      theoryElementIds: ["theory-purpose-review-value"]
    },
    {
      id: "explainer-density-intuition",
      kind: "intuition",
      title: "Value per second per pixel",
      content:
        "The prepared talk states the compact intuition directly: density should be evaluated as value delivered across the time and space the interface consumes.",
      epistemicKind: "source_fact",
      sourceIds: ["source-dense-by-design"],
      fragmentIds: [preparedTranscriptExtraction.fragments[0].id],
      theoryElementIds: ["theory-concept-time-density", "theory-concept-value-density"]
    },
    {
      id: "explainer-density-mechanism",
      kind: "mechanism",
      title: "Trace five linked lenses",
      content:
        "Move from appearance to consequence: inspect visual load, identify information-bearing marks, read relationships created by arrangement, measure workflow time, then judge the useful outcome.",
      epistemicKind: "agent_synthesis",
      sourceIds: ["source-ui-density-2024", "source-dense-by-design"],
      fragmentIds: [preparedTranscriptExtraction.fragments[0].id],
      theoryElementIds: [
        "theory-concept-visual-density",
        "theory-concept-information-density",
        "theory-concept-meaning-density",
        "theory-concept-time-density",
        "theory-concept-value-density"
      ]
    },
    {
      id: "explainer-density-details",
      kind: "details",
      title: "Constraints remain part of the equation",
      content:
        "A faster or more compact interface is not automatically better. Recommendations remain bounded by legibility, target size, expertise, error cost, and the context a person needs to recover their place.",
      epistemicKind: "agent_synthesis",
      sourceIds: ["source-wcag-target-size", "source-ui-density-2024"],
      fragmentIds: [],
      theoryElementIds: ["theory-boundary-accessibility"]
    },
    {
      id: "explainer-density-assumptions",
      kind: "assumptions",
      title: "What this explanation is assuming",
      content:
        "We are assuming the workflow has a named user and observable objective. We have not yet established how much the right density changes between novice and expert use.",
      epistemicKind: "hypothesis",
      sourceIds: [],
      fragmentIds: [],
      theoryElementIds: []
    }
  ],
  understandingCheckSeeds: [
    {
      id: "check-density-distinction",
      prompt: "Explain why a visually busy interface can still have high value density.",
      sectionIds: ["explainer-density-background", "explainer-density-intuition"]
    },
    {
      id: "check-density-boundary",
      prompt: "Name one density improvement you would reject and the constraint that rejects it.",
      sectionIds: ["explainer-density-mechanism", "explainer-density-details"]
    }
  ],
  microWorldSeed: {
    title: "Operational queue trade-off",
    scenario: "Tune a triage queue for an expert operator without hiding urgency or shrinking interaction targets.",
    variables: [
      { id: "visible-context", label: "Visible context", lowLabel: "Minimal", highLabel: "Complete", initialValue: 62 },
      {
        id: "interaction-steps",
        label: "Interaction steps",
        lowLabel: "Direct",
        highLabel: "Layered",
        initialValue: 38
      },
      { id: "control-size", label: "Control size", lowLabel: "Compact", highLabel: "Generous", initialValue: 70 }
    ]
  }
});

export const preparedDensityMicroWorld = microWorldArtifactSchema.parse({
  id: "micro-world-density-queue",
  renderer: "design_density_queue",
  title: "Operational queue density lab",
  purpose:
    "Test how spacing, hierarchy, and visible information interact before applying a density recommendation to a real workflow.",
  scenario:
    "Tune a triage queue for an expert operator who must identify urgency, understand context, and act without losing target size or recovery cues.",
  sourceIds: ["source-ui-density-2024", "source-dense-by-design", "source-wcag-target-size"],
  fragmentIds: [preparedTranscriptExtraction.fragments[0].id],
  theoryElementIds: [
    "theory-purpose-review-value",
    "theory-concept-visual-density",
    "theory-concept-information-density",
    "theory-concept-meaning-density",
    "theory-concept-time-density",
    "theory-concept-value-density",
    "theory-boundary-accessibility"
  ],
  variables: [
    {
      id: "queue-spacing",
      role: "spacing",
      label: "Row spacing",
      description: "Changes separation and visible capacity without shrinking the interaction target.",
      min: 8,
      max: 24,
      step: 2,
      initialValue: 16,
      unit: "px"
    },
    {
      id: "queue-hierarchy",
      role: "hierarchy",
      label: "Hierarchy strength",
      description: "Changes the contrast between urgency, task identity, and supporting context.",
      min: 20,
      max: 100,
      step: 10,
      initialValue: 60,
      unit: "percent"
    },
    {
      id: "queue-information",
      role: "information_density",
      label: "Visible fields",
      description: "Changes how much task context is shown in each row.",
      min: 3,
      max: 7,
      step: 1,
      initialValue: 5,
      unit: "fields"
    }
  ],
  controls: [
    { id: "control-spacing", variableId: "queue-spacing", kind: "range" },
    { id: "control-hierarchy", variableId: "queue-hierarchy", kind: "range" },
    { id: "control-information", variableId: "queue-information", kind: "range" }
  ],
  outcomes: [
    {
      id: "outcome-visible-capacity",
      kind: "visible_capacity",
      label: "Visible capacity",
      description: "Estimated number of queue items visible in the fixed work area.",
      unit: "items",
      betterDirection: "higher",
      sourceIds: ["source-ui-density-2024", "source-dense-by-design"],
      theoryElementIds: ["theory-concept-visual-density", "theory-concept-information-density"]
    },
    {
      id: "outcome-scan-effort",
      kind: "scan_effort",
      label: "Estimated scan effort",
      description: "A modelled comparison signal for locating and interpreting the next urgent item.",
      unit: "seconds",
      betterDirection: "lower",
      sourceIds: ["source-ui-density-2024", "source-dense-by-design"],
      theoryElementIds: ["theory-concept-time-density", "theory-concept-value-density"]
    },
    {
      id: "outcome-hierarchy-clarity",
      kind: "hierarchy_clarity",
      label: "Hierarchy clarity",
      description: "A modelled signal for how strongly urgency and task identity stand apart from context.",
      unit: "percent",
      betterDirection: "higher",
      sourceIds: ["source-ui-density-2024", "source-wcag-target-size"],
      theoryElementIds: ["theory-concept-meaning-density", "theory-boundary-accessibility"]
    }
  ],
  prediction: {
    prompt: "If you show more fields and reduce spacing, what do you expect to happen before hierarchy is adjusted?",
    options: [
      {
        id: "prediction-faster",
        label: "Capacity and scanning both improve",
        expectedChanges: [
          { outcomeId: "outcome-visible-capacity", direction: "increase" },
          { outcomeId: "outcome-scan-effort", direction: "decrease" }
        ]
      },
      {
        id: "prediction-tradeoff",
        label: "Capacity improves, but scanning becomes harder",
        expectedChanges: [
          { outcomeId: "outcome-visible-capacity", direction: "increase" },
          { outcomeId: "outcome-scan-effort", direction: "increase" }
        ]
      },
      {
        id: "prediction-no-change",
        label: "The workflow remains effectively unchanged",
        expectedChanges: [
          { outcomeId: "outcome-visible-capacity", direction: "unchanged" },
          { outcomeId: "outcome-scan-effort", direction: "unchanged" }
        ]
      }
    ]
  },
  assumptions: [
    "The operator already understands the queue vocabulary and urgency codes.",
    "The work area remains fixed while the controls change.",
    "The outcome model compares configurations; it does not measure human cognition."
  ],
  limitations: [
    "The scan-effort and clarity values are transparent heuristics, not observed user-performance data.",
    "The renderer preserves a minimum row target and cannot model every assistive technology or input method."
  ],
  reflectionPrompts: [
    "Which change improved useful density without merely making the queue look compact?",
    "What evidence would you collect before shipping this configuration to novice operators?"
  ]
});

const preparedTranscriptEvents: EvidenceEvent[] = [
  {
    id: "evt-source-dense-by-design-synthesized",
    type: "source.synthesis_completed",
    kind: "agent_synthesis",
    createdAt: "2026-07-14T10:00:10.000Z",
    actor: "system",
    summary: "Prepared transcript fragment normalized with timestamp provenance.",
    sourceIds: ["source-dense-by-design"],
    payload: {
      sourceId: "source-dense-by-design",
      author: "Matthew Ström-Awn / Config 2026",
      outputs: { atoms: 9, lessons: 1, capabilities: 1 },
      version: preparedTranscriptExtraction.version,
      fragments: preparedTranscriptExtraction.fragments,
      proposal: preparedTranscriptProposal
    }
  },
  proposalReviewEvent(preparedTranscriptProposal, "approved", "2026-07-14T10:00:20.000Z")
];

const preparedExplainerEvent: EvidenceEvent = {
  id: "evt-learning-explainer-001",
  type: "learning.explainer_registered",
  kind: "agent_synthesis",
  createdAt: "2026-07-14T10:30:00.000Z",
  actor: "agent",
  summary: "Generated a source-grounded explainer for the prepared transfer journey.",
  sourceIds: preparedExplainer.sourceIds,
  payload: { artifact: preparedExplainer }
};

const preparedMicroWorldEvent: EvidenceEvent = {
  id: "evt-learning-micro-world-001",
  type: "learning.micro_world_registered",
  kind: "agent_synthesis",
  createdAt: "2026-07-14T10:35:00.000Z",
  actor: "agent",
  summary: "Generated a constrained design-density micro-world for the prepared learning journey.",
  sourceIds: preparedDensityMicroWorld.sourceIds,
  payload: { artifact: preparedDensityMicroWorld }
};

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

const baseSeedEvents: EvidenceEvent[] = [
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
  ...preparedTranscriptEvents,
  preparedExplainerEvent,
  preparedMicroWorldEvent,
  ...learningSeedEvents(),
  ...capabilitySeedEvents()
];

const preparedTheoryForChecks = deriveLivingTheory(baseSeedEvents, designDensityTheoryMetadata);

export const preparedUnderstandingChecks = generateUnderstandingChecks({
  theory: preparedTheoryForChecks,
  activeProject: {
    name: "Learning Foundry",
    goal: "Preserve useful context for repeated work while reducing avoidable time and attention.",
    transferScenario:
      "an expert operator must triage an unfamiliar queue without losing urgency, target size, or recovery context"
  }
});

function understandingCheckSeedEvents(): EvidenceEvent[] {
  const registrations: EvidenceEvent[] = preparedUnderstandingChecks.map((check, index) => ({
    id: `evt-understanding-check-${String(index + 1).padStart(3, "0")}`,
    type: "learning.understanding_check_registered",
    kind: "agent_synthesis",
    createdAt: `2026-07-14T11:10:0${index}.000Z`,
    actor: "agent",
    summary: `Generated a ${check.kind.replace("_", " ")} check from the Living Theory and active project.`,
    sourceIds: check.sourceIds,
    payload: { check }
  }));
  const recall = preparedUnderstandingChecks.find((check) => check.kind === "recall");
  const prediction = preparedUnderstandingChecks.find((check) => check.kind === "prediction");
  if (!recall || !prediction) throw new Error("Prepared understanding journey is incomplete");

  const recallEvaluation = understandingEvaluationSchema.parse({
    outcome: "supported",
    evaluator: "prepared",
    feedback:
      "The response reconstructs the five lenses. This supports retrieval only; prediction and transfer remain unobserved.",
    signals: [
      {
        dimension: "retrieval",
        signal: "supports",
        rationale: "The five density lenses are distinguished without reproducing the source wording.",
        theoryElementIds: recall.theoryElementIds
      },
      {
        dimension: "calibration",
        signal: "mixed",
        rationale: "Medium confidence is plausible, but one observation is not enough to establish calibration.",
        theoryElementIds: recall.theoryElementIds
      },
      {
        dimension: "source_use",
        signal: "challenges",
        rationale: "The response did not attach source support.",
        theoryElementIds: recall.theoryElementIds
      }
    ],
    reviewItems: []
  });
  const predictionEvaluation = understandingEvaluationSchema.parse({
    outcome: "needs_review",
    evaluator: "prepared",
    feedback:
      "The prediction optimizes visible capacity but does not trace the accessibility boundary to errors or recovery cost.",
    signals: [
      {
        dimension: "prediction",
        signal: "challenges",
        rationale: "The response states an outcome without the mechanism or observable failure mode requested.",
        theoryElementIds: prediction.theoryElementIds
      },
      {
        dimension: "calibration",
        signal: "challenges",
        rationale: "High confidence is not supported by the response's visible reasoning.",
        theoryElementIds: prediction.theoryElementIds
      },
      {
        dimension: "source_use",
        signal: "challenges",
        rationale: "The response did not attach source support.",
        theoryElementIds: prediction.theoryElementIds
      }
    ],
    reviewItems: [
      {
        id: "review-prediction-accessibility-boundary",
        title: "Trace the ignored boundary",
        prompt:
          "Revisit the target-size and legibility constraint. Predict how smaller controls change error rate, speed, or recovery for the named operator.",
        theoryElementIds: prediction.theoryElementIds.filter(
          (id) => id === "theory-boundary-accessibility" || id === "theory-purpose-review-value"
        ),
        sourceIds: ["source-wcag-target-size", "source-ui-density-2024"],
        fragmentIds: []
      }
    ]
  });

  return [
    ...registrations,
    {
      id: "evt-understanding-attempt-recall-prepared",
      type: "learning.understanding_attempt_recorded",
      kind: "practical_observation",
      createdAt: "2026-07-14T11:11:00.000Z",
      actor: "human",
      summary: "Reconstructed the five density lenses from memory.",
      sourceIds: recall.sourceIds,
      payload: {
        checkId: recall.id,
        response: {
          answer:
            "Visual density is the initial sense of fullness. Information asks which marks carry content, meaning asks how arrangement explains relationships, time asks how quickly work moves, and value asks what useful outcome the person gains.",
          confidence: "medium",
          sourceSupport: { level: "none", sourceIds: [], fragmentIds: [] }
        },
        evaluation: recallEvaluation
      }
    },
    {
      id: "evt-understanding-attempt-prediction-prepared",
      type: "learning.understanding_attempt_recorded",
      kind: "practical_observation",
      createdAt: "2026-07-14T11:12:00.000Z",
      actor: "human",
      summary: "Predicted the result of compressing an unfamiliar operational queue.",
      sourceIds: prediction.sourceIds,
      payload: {
        checkId: prediction.id,
        response: {
          answer: "More rows would fit, so the operator would finish the queue faster.",
          confidence: "high",
          sourceSupport: { level: "none", sourceIds: [], fragmentIds: [] }
        },
        evaluation: predictionEvaluation
      }
    }
  ];
}

export const seedEvents: EvidenceEvent[] = [...baseSeedEvents, ...understandingCheckSeedEvents()];

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
