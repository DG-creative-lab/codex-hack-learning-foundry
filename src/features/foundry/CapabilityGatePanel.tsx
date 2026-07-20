import { Check, CircleAlert, LockKeyhole } from "lucide-react";
import type { CapabilityGate } from "../../domain/capability";

export function CapabilityGatePanel({ gate }: { gate: CapabilityGate }) {
  return (
    <section className="foundry-gate" aria-labelledby="capability-gate-title">
      <header>
        <div>
          <p className="eyebrow">Activation gate / {gate.risk} risk</p>
          <h3 id="capability-gate-title">
            {gate.approvalReady ? "Ready for human decision" : "Requirements remain open"}
          </h3>
        </div>
        <span className={gate.activationReady ? "ready" : "blocked"}>
          <LockKeyhole size={14} aria-hidden="true" /> {gate.activationReady ? "Activation ready" : "Approval gated"}
        </span>
      </header>
      <div className="foundry-gate-register">
        {gate.requirements.map((requirement, index) => (
          <article key={requirement.id} data-met={requirement.met}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            {requirement.met ? <Check size={16} aria-label="Met" /> : <CircleAlert size={16} aria-label="Unmet" />}
            <div>
              <strong>{requirement.label}</strong>
              <p>{requirement.rationale}</p>
            </div>
            <small>{requirement.evidenceEventIds.length} evidence</small>
          </article>
        ))}
      </div>
    </section>
  );
}
