import { ArrowRight } from "lucide-react";
import type { LearningArtifact } from "../../domain/workspaceEntities";

export const artifactTypeLabels = {
  lesson: "Lesson",
  exercise: "Exercise",
  review: "Review set",
  reflection: "Reflection"
} as const;

export function LearningArtifactPreview({ artifact }: { artifact: LearningArtifact }) {
  return (
    <div className="artifact-preview">
      <div className="preview-meta">
        <span>{artifactTypeLabels[artifact.type]}</span>
        <span>{artifact.evidence}</span>
      </div>
      <p className="eyebrow">Active learning unit</p>
      <h2>{artifact.title}</h2>
      <p className="preview-lede">
        Generated from shared knowledge, then adapted using prior responses, confidence, weak spots, and working style.
      </p>
      <div className="lesson-sequence">
        <div>
          <span>01</span>
          <strong>Retrieve</strong>
          <p>Explain without reopening the source.</p>
        </div>
        <div>
          <span>02</span>
          <strong>Apply</strong>
          <p>Diagnose a new operational interface.</p>
        </div>
        <div>
          <span>03</span>
          <strong>Reflect</strong>
          <p>Record uncertainty and revised understanding.</p>
        </div>
      </div>
      <button type="button" className="primary-button">
        Continue session <ArrowRight size={15} />
      </button>
    </div>
  );
}
