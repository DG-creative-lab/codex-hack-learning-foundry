import { AlertTriangle, Check, X } from "lucide-react";
import type { FoundryCapability } from "../../domain/capability";
import type { UnderstandingGap } from "../../domain/understandingGaps";
import type { SourceRecord } from "../../domain/workspaceEntities";

interface CapabilityEvidencePanelProps {
  capability: FoundryCapability;
  sources: SourceRecord[];
  gaps: UnderstandingGap[];
}

export function CapabilityEvidencePanel({ capability, sources, gaps }: CapabilityEvidencePanelProps) {
  const { manifest } = capability;
  const resultsById = new Map(capability.evaluation?.result.cases.map((result) => [result.caseId, result]));

  return (
    <section className="foundry-evidence" aria-label="Capability evidence dossier">
      <div className="foundry-evidence-column">
        <header>
          <p className="eyebrow">Provenance</p>
          <span>{manifest.sourceIds.length}</span>
        </header>
        {manifest.sourceIds.map((sourceId) => {
          const source = sources.find((candidate) => candidate.id === sourceId);
          return (
            <p className="foundry-source" key={sourceId}>
              <strong>{source?.title ?? sourceId}</strong>
              <span>{source?.author ?? "Approved source"}</span>
            </p>
          );
        })}
        <header>
          <p className="eyebrow">Assumptions</p>
          <span>{manifest.assumptions.length}</span>
        </header>
        <ol>
          {manifest.assumptions.map((assumption) => (
            <li key={assumption}>{assumption}</li>
          ))}
        </ol>
        <header>
          <p className="eyebrow">Operating boundaries</p>
          <span>{manifest.operatingBoundaries.length}</span>
        </header>
        <ol>
          {manifest.operatingBoundaries.map((boundary) => (
            <li key={boundary}>{boundary}</li>
          ))}
        </ol>
      </div>

      <div className="foundry-evaluation-column">
        <header>
          <p className="eyebrow">Declared evaluation cases</p>
          <span>
            {capability.evaluation
              ? `${capability.evaluation.result.passed}/${capability.evaluation.result.total}`
              : "Pending"}
          </span>
        </header>
        <div className="foundry-case-register">
          {manifest.evaluationCases.map((evaluationCase, index) => {
            const result = resultsById.get(evaluationCase.id);
            return (
              <article key={evaluationCase.id} data-status={result?.status ?? "pending"}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <strong>{evaluationCase.title}</strong>
                  <p>{evaluationCase.expectation}</p>
                  {result && <small>{result.evidence}</small>}
                </div>
                {result?.status === "passed" ? (
                  <Check size={16} aria-label="Passed" />
                ) : result?.status === "failed" ? (
                  <X size={16} aria-label="Failed" />
                ) : (
                  <span className="case-pending">Pending</span>
                )}
              </article>
            );
          })}
        </div>
        <header>
          <p className="eyebrow">Relevant understanding gaps</p>
          <span>{gaps.length}</span>
        </header>
        {gaps.length > 0 ? (
          <div className="foundry-gap-list">
            {gaps.map((gap) => (
              <article key={gap.id}>
                <AlertTriangle size={15} aria-hidden="true" />
                <div>
                  <strong>{gap.title}</strong>
                  <p>{gap.why}</p>
                </div>
                <span>{gap.level}</span>
              </article>
            ))}
          </div>
        ) : (
          <p className="foundry-empty-row">No currently detected gap targets this capability.</p>
        )}
      </div>
    </section>
  );
}
