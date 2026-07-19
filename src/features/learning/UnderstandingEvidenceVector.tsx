import { type UnderstandingDimension, understandingDimensionSchema } from "../../domain/understandingChecks";
import type { EvidenceVectorIndex } from "./types";

const dimensionLabels: Record<UnderstandingDimension, string> = {
  retrieval: "Recall",
  explanation: "Explain",
  prediction: "Predict",
  transfer: "Transfer",
  calibration: "Calibration",
  source_use: "Source use"
};

interface UnderstandingEvidenceVectorProps {
  theoryElementIds: string[];
  vectorsByTheoryId: EvidenceVectorIndex;
}

export function UnderstandingEvidenceVector({ theoryElementIds, vectorsByTheoryId }: UnderstandingEvidenceVectorProps) {
  const dimensions = understandingDimensionSchema.options.map((dimension) => {
    const evidence = theoryElementIds
      .map((id) => vectorsByTheoryId.get(id)?.dimensions[dimension])
      .filter((item) => item !== undefined);
    const counts = evidence.reduce(
      (total, item) => ({
        supports: total.supports + item.supports,
        mixed: total.mixed + item.mixed,
        challenges: total.challenges + item.challenges
      }),
      { supports: 0, mixed: 0, challenges: 0 }
    );
    const state =
      counts.challenges > 0
        ? "Challenged"
        : counts.mixed > 0
          ? "Mixed evidence"
          : counts.supports > 0
            ? "Supported"
            : "Not observed";
    return { dimension, counts, state };
  });

  return (
    <section className="evidence-vector" aria-label="Understanding evidence vector">
      <div className="check-section-heading">
        <p className="eyebrow">Evidence vector</p>
        <span>No aggregate score</span>
      </div>
      <div className="evidence-vector-grid">
        {dimensions.map(({ dimension, counts, state }) => (
          <div key={dimension} data-state={state.toLowerCase().replace(" ", "-")}>
            <span>{dimensionLabels[dimension]}</span>
            <strong>{state}</strong>
            <small>
              {counts.supports} support · {counts.mixed} mixed · {counts.challenges} challenge
            </small>
          </div>
        ))}
      </div>
    </section>
  );
}
