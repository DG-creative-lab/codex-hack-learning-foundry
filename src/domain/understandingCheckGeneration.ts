import type { LivingTheory, TheoryElement } from "./types";
import {
  UNDERSTANDING_CHECK_LIMITS,
  type UnderstandingCheck,
  type UnderstandingCheckKind,
  type UnderstandingDimension,
  type UnderstandingEvaluation,
  type UnderstandingResponse,
  type UnderstandingSignal,
  understandingCheckSchema,
  understandingEvaluationSchema
} from "./understandingChecks";

interface ActiveProjectContext {
  name: string;
  goal: string;
  transferScenario: string;
}

export interface GenerateUnderstandingChecksInput {
  theory: LivingTheory;
  activeProject: ActiveProjectContext;
  cycle?: number;
}

const promptOpeners = ["Without reopening the sources", "From memory", "Using a fresh framing"] as const;

function uniqueElements(elements: TheoryElement[]): TheoryElement[] {
  return [...new Map(elements.map((element) => [element.id, element])).values()];
}

function sourceIdsFor(elements: TheoryElement[], theory: LivingTheory): string[] {
  const ids = [...new Set(elements.flatMap((element) => element.sourceIds))];
  return ids.length > 0 ? ids : theory.sourceIds.slice(0, 1);
}

function fragmentIdsFor(elements: TheoryElement[]): string[] {
  return [...new Set(elements.flatMap((element) => element.fragmentIds))];
}

export function generateUnderstandingChecks({
  theory,
  activeProject,
  cycle = 1
}: GenerateUnderstandingChecksInput): UnderstandingCheck[] {
  if (!Number.isInteger(cycle) || cycle < 1) throw new Error("Understanding-check cycle must be a positive integer");
  const active = theory.elements.filter((element) => element.status === "active");
  const concepts = active.filter((element) => element.kind === "concept").slice(0, 5);
  const purpose = active.find((element) => element.kind === "purpose");
  const boundary = active.find((element) => element.kind === "boundary");
  const unresolved = theory.elements.find((element) => element.status === "unresolved");
  if (!purpose) throw new Error("Understanding checks require an active purpose in the Living Theory");
  if (!boundary) throw new Error("Understanding checks require an active boundary in the Living Theory");
  if (concepts.length === 0) throw new Error("Understanding checks require an active concept in the Living Theory");
  const opener = promptOpeners[(cycle - 1) % promptOpeners.length];
  const context = `${activeProject.name}: ${activeProject.goal}`;
  const cycleInstruction = cycle === 1 ? "" : ` Use a new example or framing for learning cycle ${cycle}.`;
  const vary = (prompt: string) => `${prompt}${cycleInstruction}`;

  function createCheck(
    kind: UnderstandingCheckKind,
    sequence: number,
    family: string,
    prompt: string,
    purposeText: string,
    elementsInput: TheoryElement[],
    primaryDimension: UnderstandingDimension
  ): UnderstandingCheck {
    const elements = uniqueElements(elementsInput);
    const sourceIds = sourceIdsFor(elements, theory);
    const fragmentIds = fragmentIdsFor(elements);
    return understandingCheckSchema.parse({
      id: `check-${theory.id}-${kind}-c${cycle}`,
      kind,
      prompt,
      purpose: purposeText,
      projectContext: context,
      sequence,
      cue: { family, variant: `cycle-${cycle}-${sequence}` },
      sourceIds,
      fragmentIds,
      theoryElementIds: elements.map((element) => element.id),
      evaluationGuide: elements.slice(0, UNDERSTANDING_CHECK_LIMITS.criteria).map((element, index) => ({
        id: `criterion-${kind}-${cycle}-${index + 1}`,
        dimension: primaryDimension,
        description: `Connect the response to ${element.title}: ${element.statement}`,
        theoryElementIds: [element.id],
        sourceIds: element.sourceIds.filter((sourceId) => sourceIds.includes(sourceId)),
        fragmentIds: element.fragmentIds.filter((fragmentId) => fragmentIds.includes(fragmentId))
      }))
    });
  }

  return [
    createCheck(
      "recall",
      1,
      "concept-reconstruction",
      vary(`${opener}, reconstruct the key lenses in ${theory.title} and state what each helps you notice.`),
      "Test whether the conceptual distinctions are available without the original cue.",
      concepts,
      "retrieval"
    ),
    createCheck(
      "explanation",
      2,
      "causal-explanation",
      vary(
        `Explain to a project collaborator why “${purpose.title}” is a better decision rule for ${activeProject.name} than visual compactness alone.`
      ),
      "Externalize the mechanism and practical purpose, not only the vocabulary.",
      [purpose, ...concepts.slice(0, 2)],
      "explanation"
    ),
    createCheck(
      "prediction",
      3,
      "consequence-prediction",
      vary(
        `Predict what would happen in ${activeProject.transferScenario} if “${boundary.title}” were ignored. State the mechanism and an observable result.`
      ),
      "Use the theory to anticipate consequences before seeing the outcome.",
      unresolved ? [boundary, purpose, unresolved] : [boundary, purpose],
      "prediction"
    ),
    createCheck(
      "teach_back",
      4,
      "novice-teach-back",
      vary(
        `Teach back “${concepts[0].title}” to a capable designer who has not read the sources. Include one example and one boundary.`
      ),
      "Reveal whether the learner can reorganize the idea for another person.",
      [concepts[0], boundary, purpose],
      "explanation"
    ),
    createCheck(
      "transfer",
      5,
      "unfamiliar-transfer",
      vary(
        `Apply “${purpose.title}” to this unfamiliar case: ${activeProject.transferScenario} Make a recommendation, preserve a constraint, and name what evidence would change your decision.`
      ),
      "Test whether the model can guide action beyond the source example.",
      [purpose, boundary, ...concepts.slice(-2)],
      "transfer"
    )
  ];
}

const primaryDimensionByKind: Record<UnderstandingCheckKind, UnderstandingDimension> = {
  recall: "retrieval",
  explanation: "explanation",
  prediction: "prediction",
  teach_back: "explanation",
  transfer: "transfer"
};

export function createProvisionalEvaluation(
  check: UnderstandingCheck,
  response: UnderstandingResponse
): UnderstandingEvaluation {
  const hasEnoughMaterial = response.answer.split(/\s+/).filter(Boolean).length >= 18;
  const primaryDimension = primaryDimensionByKind[check.kind];
  const primaryTheoryIds = check.evaluationGuide
    .filter((criterion) => criterion.dimension === primaryDimension)
    .flatMap((criterion) => criterion.theoryElementIds);
  const theoryElementIds = [...new Set(primaryTheoryIds.length > 0 ? primaryTheoryIds : check.theoryElementIds)];
  const firstCriterion = check.evaluationGuide[0];
  const reviewItems = hasEnoughMaterial
    ? []
    : [
        {
          id: `review-${check.id}-${firstCriterion.id}`,
          title: `Revisit ${check.kind.replace("_", " ")}`,
          prompt: `${firstCriterion.description} Then revise the response with a concrete mechanism or example.`,
          theoryElementIds: firstCriterion.theoryElementIds,
          sourceIds: firstCriterion.sourceIds.length > 0 ? firstCriterion.sourceIds : check.sourceIds.slice(0, 1),
          fragmentIds: firstCriterion.fragmentIds
        }
      ];
  const sourceSignal: UnderstandingSignal =
    response.sourceSupport.level === "cited"
      ? "supports"
      : response.sourceSupport.level === "reasoned"
        ? "mixed"
        : "challenges";

  return understandingEvaluationSchema.parse({
    outcome: hasEnoughMaterial ? "partial" : "needs_review",
    evaluator: "provisional_agent",
    feedback: hasEnoughMaterial
      ? "The response contains enough structure for review, but semantic support remains provisional until an agent or human checks it against the evaluation guide."
      : "The response does not yet expose enough reasoning to evaluate the mechanism. A targeted source-grounded review item has been created.",
    signals: [
      {
        dimension: primaryDimension,
        signal: hasEnoughMaterial ? "mixed" : "challenges",
        rationale: hasEnoughMaterial
          ? "The response provides inspectable reasoning, but this local evaluator does not claim semantic correctness."
          : "The response is too brief to expose an inspectable chain of reasoning.",
        theoryElementIds
      },
      {
        dimension: "source_use",
        signal: sourceSignal,
        rationale:
          response.sourceSupport.level === "cited"
            ? "The learner attached explicit source support."
            : response.sourceSupport.level === "reasoned"
              ? "The learner marked the response as reasoned without an explicit citation."
              : "The response does not claim source support.",
        theoryElementIds
      }
    ],
    reviewItems
  });
}
