import { Send, ShieldCheck, X } from "lucide-react";
import { useState } from "react";
import { CAPABILITY_LIMITS, type FoundryCapability } from "../../domain/capability";

interface CapabilityDecisionPanelProps {
  capability: FoundryCapability;
  onApprove: (capabilityId: string, reason: string) => Promise<void>;
  onReject: (capabilityId: string, reason: string, revisionRequest: string) => Promise<void>;
  onActivate: (capabilityId: string, reason: string) => Promise<void>;
}

export function CapabilityDecisionPanel({ capability, onApprove, onReject, onActivate }: CapabilityDecisionPanelProps) {
  const [reason, setReason] = useState("");
  const [revisionRequest, setRevisionRequest] = useState("");
  const [pending, setPending] = useState<"approve" | "reject" | "activate">();
  const [error, setError] = useState<string>();
  const validReason = reason.trim().length >= 3;
  const validRevision = revisionRequest.trim().length >= 3;

  async function execute(kind: "approve" | "reject" | "activate", command: () => Promise<void>) {
    setPending(kind);
    setError(undefined);
    try {
      await command();
      setReason("");
      setRevisionRequest("");
    } catch (commandError) {
      setError(commandError instanceof Error ? commandError.message : String(commandError));
    } finally {
      setPending(undefined);
    }
  }

  if (capability.manifest.status === "rejected") {
    return (
      <section className="foundry-decision" aria-labelledby="capability-decision-title">
        <p className="eyebrow">Human decision</p>
        <h3 id="capability-decision-title">Revision required</h3>
        <p>{capability.decision?.payload.reason}</p>
        <strong>
          {capability.decision?.payload.decision === "rejected" && capability.decision.payload.revisionRequest}
        </strong>
      </section>
    );
  }

  if (capability.manifest.status === "active") {
    return (
      <section className="foundry-decision" aria-labelledby="capability-decision-title">
        <p className="eyebrow">Human decision</p>
        <h3 id="capability-decision-title">Capability active</h3>
        <p>{capability.activation?.payload.reason}</p>
      </section>
    );
  }

  if (capability.manifest.status === "approved") {
    return (
      <section className="foundry-decision" aria-labelledby="capability-decision-title">
        <p className="eyebrow">Activation</p>
        <h3 id="capability-decision-title">Approval recorded. Activation remains separate.</h3>
        <label htmlFor={`activation-reason-${capability.manifest.id}`}>Why activate this version now?</label>
        <textarea
          id={`activation-reason-${capability.manifest.id}`}
          value={reason}
          maxLength={CAPABILITY_LIMITS.reasonCharacters}
          onChange={(event) => setReason(event.target.value)}
        />
        {error && <p role="alert">{error}</p>}
        <button
          type="button"
          className="primary-button"
          disabled={!validReason || pending !== undefined || !capability.gate.activationReady}
          onClick={() => void execute("activate", () => onActivate(capability.manifest.id, reason))}
        >
          <ShieldCheck size={15} /> {pending === "activate" ? "Activating..." : "Activate approved version"}
        </button>
      </section>
    );
  }

  if (capability.manifest.status !== "evaluated") {
    return (
      <section className="foundry-decision" aria-labelledby="capability-decision-title">
        <p className="eyebrow">Human decision</p>
        <h3 id="capability-decision-title">Evaluation required before decision</h3>
        <p>The draft remains inspectable, but synthesis alone cannot enable approval or activation.</p>
      </section>
    );
  }

  return (
    <section className="foundry-decision" aria-labelledby="capability-decision-title">
      <p className="eyebrow">Human decision</p>
      <h3 id="capability-decision-title">Approve or request a revision</h3>
      <label htmlFor={`decision-reason-${capability.manifest.id}`}>Decision rationale</label>
      <textarea
        id={`decision-reason-${capability.manifest.id}`}
        value={reason}
        maxLength={CAPABILITY_LIMITS.reasonCharacters}
        onChange={(event) => setReason(event.target.value)}
      />
      <label htmlFor={`revision-request-${capability.manifest.id}`}>Revision request for rejection</label>
      <textarea
        id={`revision-request-${capability.manifest.id}`}
        value={revisionRequest}
        maxLength={CAPABILITY_LIMITS.revisionCharacters}
        onChange={(event) => setRevisionRequest(event.target.value)}
      />
      {error && <p role="alert">{error}</p>}
      <div>
        <button
          type="button"
          className="secondary-button"
          disabled={!validReason || !validRevision || pending !== undefined}
          onClick={() => void execute("reject", () => onReject(capability.manifest.id, reason, revisionRequest))}
        >
          <X size={15} /> {pending === "reject" ? "Recording..." : "Reject and request revision"}
        </button>
        <button
          type="button"
          className="primary-button"
          disabled={!validReason || pending !== undefined || !capability.gate.approvalReady}
          onClick={() => void execute("approve", () => onApprove(capability.manifest.id, reason))}
        >
          <Send size={15} /> {pending === "approve" ? "Recording..." : "Record approval"}
        </button>
      </div>
    </section>
  );
}
