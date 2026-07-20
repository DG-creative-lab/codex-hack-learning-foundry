import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { capabilityStatusValues } from "../../shared/capability-contract.js";
import { UnderstandingContextBar } from "../components/UnderstandingContextBar";
import type { FoundryCapability } from "../domain/capability";
import type { UnderstandingGapProjection } from "../domain/understandingGaps";
import type { SourceRecord } from "../domain/workspaceEntities";
import { CapabilityDecisionPanel } from "../features/foundry/CapabilityDecisionPanel";
import { CapabilityEvidencePanel } from "../features/foundry/CapabilityEvidencePanel";
import { CapabilityGatePanel } from "../features/foundry/CapabilityGatePanel";
import "../features/foundry/foundry.css";

const capabilityTypeLabels = {
  "knowledge-module": "Knowledge module",
  skill: "Skill",
  tool: "Tool",
  plugin: "Plugin"
} as const;

interface FoundryViewProps {
  capabilities: FoundryCapability[];
  sources: SourceRecord[];
  understandingGaps: UnderstandingGapProjection;
  requestedCapabilityId?: string;
  contextTitle?: string;
  onReturnToTheory?: () => void;
  onApprove: (capabilityId: string, reason: string) => Promise<void>;
  onReject: (capabilityId: string, reason: string, revisionRequest: string) => Promise<void>;
  onActivate: (capabilityId: string, reason: string) => Promise<void>;
}

function lifecycleReached(status: FoundryCapability["manifest"]["status"], step: string) {
  if (step === "draft") return true;
  if (step === "evaluated") return status !== "draft";
  if (step === "approved") return status === "approved" || status === "active";
  return step === status;
}

export function FoundryView({
  capabilities,
  sources,
  understandingGaps,
  requestedCapabilityId,
  contextTitle,
  onReturnToTheory,
  onApprove,
  onReject,
  onActivate
}: FoundryViewProps) {
  const requestedCapability = capabilities.find((item) => item.manifest.id === requestedCapabilityId);
  const [selectedId, setSelectedId] = useState(requestedCapability?.manifest.id ?? capabilities[0]?.manifest.id);
  useEffect(() => {
    if (requestedCapability) setSelectedId(requestedCapability.manifest.id);
  }, [requestedCapability]);
  const capability = capabilities.find((item) => item.manifest.id === selectedId) ?? capabilities[0];

  if (!capability) {
    return (
      <div className="page-scroll foundry-view foundry-shell">
        {onReturnToTheory && (
          <UnderstandingContextBar contextTitle={contextTitle ?? "Living Theory"} onReturnToTheory={onReturnToTheory} />
        )}
        <p className="eyebrow">No capabilities have been recorded.</p>
      </div>
    );
  }

  const { manifest } = capability;
  const theoryElementIds = new Set(manifest.theoryElementIds);
  const relevantGaps = understandingGaps.gaps.filter(
    (gap) =>
      gap.status !== "dismissed" &&
      (gap.affectedTheoryElementIds.some((id) => theoryElementIds.has(id)) ||
        (gap.recommendedIntervention.destination.kind === "capability" &&
          gap.recommendedIntervention.destination.id === manifest.id))
  );

  return (
    <div className="page-scroll foundry-view foundry-shell">
      {onReturnToTheory && (
        <UnderstandingContextBar contextTitle={contextTitle ?? "Living Theory"} onReturnToTheory={onReturnToTheory} />
      )}
      <section className="foundry-approval-header">
        <div>
          <p className="eyebrow">Controlled capability activation</p>
          <h2>Evidence before authority.</h2>
        </div>
        <p>Evaluation informs a human decision. It never activates a generated capability on its own.</p>
      </section>

      <section className="foundry-approval-workspace">
        <div className="foundry-register">
          <header>
            <span>Capability</span>
            <span>Status</span>
          </header>
          {capabilities.map((item, index) => (
            <button
              type="button"
              key={item.manifest.id}
              className={manifest.id === item.manifest.id ? "selected" : ""}
              aria-pressed={manifest.id === item.manifest.id}
              onClick={() => setSelectedId(item.manifest.id)}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <span>
                <small>{capabilityTypeLabels[item.manifest.type]}</small>
                <strong>{item.manifest.name}</strong>
                <small>v{item.manifest.version}</small>
              </span>
              <span>{item.manifest.status}</span>
            </button>
          ))}
        </div>

        <div className="foundry-dossier">
          <header className="foundry-dossier-title">
            <div>
              <p className="eyebrow">
                {capabilityTypeLabels[manifest.type]} / version {manifest.version}
              </p>
              <h2>{manifest.name}</h2>
              <code>{manifest.skillPath}</code>
            </div>
            <span>{manifest.status}</span>
          </header>

          <ol className="foundry-lifecycle" aria-label={`Current capability state: ${manifest.status}`}>
            {capabilityStatusValues.map((step, index) => {
              const reached = lifecycleReached(manifest.status, step);
              return (
                <li key={step} data-current={step === manifest.status} data-reached={reached}>
                  <i>{reached ? <Check size={11} aria-hidden="true" /> : index + 1}</i>
                  {step}
                </li>
              );
            })}
          </ol>

          <CapabilityGatePanel gate={capability.gate} />
          <CapabilityEvidencePanel capability={capability} sources={sources} gaps={relevantGaps} />
          <CapabilityDecisionPanel
            key={`${manifest.id}:${manifest.status}`}
            capability={capability}
            onApprove={onApprove}
            onReject={onReject}
            onActivate={onActivate}
          />

          <footer className="foundry-artifact-footer">
            <span>{manifest.theoryElementIds.length} linked theory elements</span>
            <code>{manifest.skillPath}</code>
          </footer>
        </div>
      </section>
    </div>
  );
}
