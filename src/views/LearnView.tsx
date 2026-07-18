import { ArrowRight } from "lucide-react";
import { useState } from "react";
import type { LearningArtifact } from "../domain/workspaceEntities";

const artifactTypeLabels = {
  lesson: "Lesson",
  exercise: "Exercise",
  review: "Review set",
  reflection: "Reflection"
} as const;

interface LearnViewProps {
  artifacts: LearningArtifact[];
}

export function LearnView({ artifacts }: LearnViewProps) {
  const [selectedArtifact, setSelectedArtifact] = useState(artifacts[0]?.id);
  const artifact = artifacts.find((item) => item.id === selectedArtifact) ?? artifacts[0];

  if (!artifact) {
    return (
      <div className="page-scroll learn-view">
        <p className="eyebrow">No learning artifacts have been recorded.</p>
      </div>
    );
  }

  return (
    <div className="page-scroll learn-view">
      <section className="learning-header">
        <div>
          <p className="eyebrow">Human learning state</p>
          <h2>Current objective</h2>
          <p>
            Explain the five density lenses, apply them to an unfamiliar interface, and separate preference from
            observed value.
          </p>
        </div>
        <div className="learning-metrics">
          <p>
            <span>Recall</span>
            <strong>76%</strong>
          </p>
          <p>
            <span>Application</span>
            <strong>82%</strong>
          </p>
          <p>
            <span>Transfer</span>
            <strong>54%</strong>
          </p>
        </div>
      </section>
      <section className="artifact-workspace">
        <div className="artifact-list">
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">Generated artifacts</p>
              <h2>Learning path</h2>
            </div>
          </div>
          {artifacts.map((item, index) => (
            <button
              type="button"
              key={item.id}
              className={artifact.id === item.id ? "selected" : ""}
              onClick={() => setSelectedArtifact(item.id)}
            >
              <span className="artifact-index">0{index + 1}</span>
              <span>
                <small>{artifactTypeLabels[item.type]}</small>
                <strong>{item.title}</strong>
                <i>
                  <b style={{ width: `${item.progress}%` }} />
                </i>
              </span>
              <span>{item.statusLabel}</span>
            </button>
          ))}
        </div>
        <div className="artifact-preview">
          <div className="preview-meta">
            <span>{artifactTypeLabels[artifact.type]}</span>
            <span>{artifact.evidence}</span>
          </div>
          <p className="eyebrow">Active learning unit</p>
          <h2>{artifact.title}</h2>
          <p className="preview-lede">
            Generated from shared knowledge, then adapted using your prior responses, confidence, weak spots, and
            preferred working style.
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
      </section>
    </div>
  );
}
