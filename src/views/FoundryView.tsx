import { Check, ExternalLink, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { capabilityStatusValues } from "../../shared/capability-contract.js";
import { capabilities } from "../data/workspace";

const capabilityTypeLabels = {
  "knowledge-module": "Knowledge module",
  skill: "Skill",
  tool: "Tool",
  plugin: "Plugin"
} as const;

export function FoundryView() {
  const [selectedId, setSelectedId] = useState(capabilities[0].manifest.id);
  const capability = capabilities.find((item) => item.manifest.id === selectedId) ?? capabilities[0];
  const { manifest } = capability;
  const currentStep = capabilityStatusValues.indexOf(manifest.status);

  return (
    <div className="page-scroll foundry-view">
      <section className="foundry-header">
        <div>
          <p className="eyebrow">Agent capability state</p>
          <h2>Knowledge becomes controlled action.</h2>
        </div>
        <p>Artifacts advance only through inspectable evidence, evaluation, and explicit human approval.</p>
      </section>
      <section className="capability-workspace">
        <div className="capability-list">
          <div className="capability-head">
            <span>Artifact</span>
            <span>Version</span>
            <span>Status</span>
          </div>
          {capabilities.map((item) => (
            <button
              type="button"
              key={item.manifest.id}
              className={selectedId === item.manifest.id ? "selected" : ""}
              onClick={() => setSelectedId(item.manifest.id)}
            >
              <span>
                <small>{capabilityTypeLabels[item.manifest.type]}</small>
                <strong>{item.manifest.name}</strong>
              </span>
              <span>{item.manifest.version}</span>
              <span>{item.manifest.status}</span>
            </button>
          ))}
        </div>
        <div className="capability-detail">
          <div className="detail-title">
            <div>
              <p className="eyebrow">{capabilityTypeLabels[manifest.type]}</p>
              <h2>{manifest.name}</h2>
            </div>
            <span className="status-stamp">{manifest.status}</span>
          </div>
          <div className="capability-stats">
            <p>
              <strong>{manifest.sourceIds.length}</strong>
              <span>sources</span>
            </p>
            <p>
              <strong>
                {capability.evaluation ? `${capability.evaluation.passed} / ${capability.evaluation.total}` : "—"}
              </strong>
              <span>evaluations</span>
            </p>
            <p>
              <strong>{capability.executions}</strong>
              <span>executions</span>
            </p>
          </div>
          <div className="lifecycle">
            <p className="eyebrow">Controlled evolution</p>
            {capabilityStatusValues.map((step, index) => {
              const reached = index <= currentStep;
              return (
                <div key={step} className={reached ? "reached" : ""}>
                  <i>{reached ? <Check size={11} /> : index + 1}</i>
                  <span>{step}</span>
                </div>
              );
            })}
          </div>
          <div className="foundry-actions">
            <button type="button" className="secondary-button">
              <ExternalLink size={14} /> Inspect artifact
            </button>
            <button type="button" className="primary-button" disabled={manifest.status !== "evaluated"}>
              <ShieldCheck size={14} /> Approve activation
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
