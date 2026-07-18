import { Check, ExternalLink, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { capabilityStatusValues } from "../../shared/capability-status.js";
import { capabilities } from "../data/workspace";

export function FoundryView() {
  const [selectedId, setSelectedId] = useState(capabilities[0].id);
  const capability = capabilities.find((item) => item.id === selectedId) ?? capabilities[0];
  const currentStep = capabilityStatusValues.indexOf(capability.status);

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
              key={item.id}
              className={selectedId === item.id ? "selected" : ""}
              onClick={() => setSelectedId(item.id)}
            >
              <span>
                <small>{item.type}</small>
                <strong>{item.name}</strong>
              </span>
              <span>{item.version}</span>
              <span>{item.status}</span>
            </button>
          ))}
        </div>
        <div className="capability-detail">
          <div className="detail-title">
            <div>
              <p className="eyebrow">{capability.type}</p>
              <h2>{capability.name}</h2>
            </div>
            <span className="status-stamp">{capability.status}</span>
          </div>
          <div className="capability-stats">
            <p>
              <strong>{capability.sources}</strong>
              <span>sources</span>
            </p>
            <p>
              <strong>{capability.evaluations}</strong>
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
            <button type="button" className="primary-button" disabled={capability.status !== "evaluated"}>
              <ShieldCheck size={14} /> Approve activation
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
