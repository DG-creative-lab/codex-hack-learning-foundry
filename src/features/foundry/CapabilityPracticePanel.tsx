import { MessageSquare, Play } from "lucide-react";
import { useEffect, useState } from "react";
import type { ExecutionAdapterId, ExecutionAvailability } from "../../application/executionAdapters";
import type { FoundryCapability } from "../../domain/capability";
import {
  PRACTICAL_EVIDENCE_LIMITS,
  type PracticalApplication,
  type PracticalFeedback,
  type PracticalFeedbackKind
} from "../../domain/practicalEvidence";

interface CapabilityPracticePanelProps {
  capability: FoundryCapability;
  applications: PracticalApplication[];
  feedback: PracticalFeedback[];
  onExecute: (
    capabilityId: string,
    inputSummary: string,
    adapterId: ExecutionAdapterId,
    consent: boolean
  ) => Promise<string>;
  onExecutionAvailability: (adapterId: ExecutionAdapterId) => Promise<ExecutionAvailability>;
  onFeedback: (
    subjectEventId: string,
    kind: PracticalFeedbackKind,
    content: string,
    focusTheoryElementId?: string
  ) => Promise<string>;
}

const feedbackLabels: Record<PracticalFeedbackKind, string> = {
  observation: "Observation",
  correction: "Correction",
  failure: "Failure",
  participation: "Participation"
};

export function CapabilityPracticePanel({
  capability,
  applications,
  feedback,
  onExecute,
  onExecutionAvailability,
  onFeedback
}: CapabilityPracticePanelProps) {
  const [inputSummary, setInputSummary] = useState("");
  const [adapterId, setAdapterId] = useState<ExecutionAdapterId>("prepared");
  const [liveConsent, setLiveConsent] = useState(false);
  const [liveAvailability, setLiveAvailability] = useState<ExecutionAvailability>();
  const [checkingLive, setCheckingLive] = useState(false);
  const [feedbackKind, setFeedbackKind] = useState<PracticalFeedbackKind>("observation");
  const [feedbackContent, setFeedbackContent] = useState("");
  const [focusTheoryElementId, setFocusTheoryElementId] = useState(
    capability.manifest.theoryElementIds.find((id) => id.includes("value-density")) ??
      capability.manifest.theoryElementIds[0] ??
      ""
  );
  const [pending, setPending] = useState<"execute" | "feedback">();
  const [error, setError] = useState<string>();
  const latestApplication = applications.at(-1);
  const latestFeedback = feedback.filter((item) => item.subjectEventId === latestApplication?.evidenceEventId).at(-1);

  useEffect(() => {
    if (adapterId !== "live_codex") return;
    let current = true;
    setCheckingLive(true);
    void onExecutionAvailability("live_codex")
      .then((availability) => {
        if (current) setLiveAvailability(availability);
      })
      .catch(() => {
        if (current) {
          setLiveAvailability({
            available: false,
            code: "codex_unavailable",
            message: "Live Codex availability could not be checked. A prepared fallback remains available."
          });
        }
      })
      .finally(() => {
        if (current) setCheckingLive(false);
      });
    return () => {
      current = false;
    };
  }, [adapterId, onExecutionAvailability]);

  async function execute(kind: "execute" | "feedback", command: () => Promise<unknown>) {
    setPending(kind);
    setError(undefined);
    try {
      await command();
      if (kind === "execute") {
        setInputSummary("");
      } else {
        setFeedbackContent("");
      }
    } catch (commandError) {
      setError(commandError instanceof Error ? commandError.message : String(commandError));
    } finally {
      setPending(undefined);
    }
  }

  if (capability.manifest.status !== "active" && applications.length === 0) return null;

  return (
    <section className="foundry-practice" aria-labelledby={`practice-title-${capability.manifest.id}`}>
      <header>
        <div>
          <p className="eyebrow">Practical application</p>
          <h3 id={`practice-title-${capability.manifest.id}`}>Execute, observe, and correct</h3>
        </div>
        <span>{applications.length} recorded</span>
      </header>

      {capability.manifest.status === "active" && (
        <div className="foundry-practice-form">
          <label htmlFor={`application-input-${capability.manifest.id}`}>Task input</label>
          <textarea
            id={`application-input-${capability.manifest.id}`}
            value={inputSummary}
            maxLength={PRACTICAL_EVIDENCE_LIMITS.summaryCharacters}
            disabled={pending !== undefined}
            onChange={(event) => setInputSummary(event.target.value)}
          />

          <span className="foundry-field-label">Execution adapter</span>
          <fieldset className="foundry-segmented foundry-adapter-selector" aria-label="Execution adapter">
            <button
              type="button"
              aria-pressed={adapterId === "prepared"}
              disabled={pending !== undefined}
              onClick={() => {
                setAdapterId("prepared");
                setLiveConsent(false);
              }}
            >
              Prepared
            </button>
            <button
              type="button"
              aria-pressed={adapterId === "live_codex"}
              disabled={pending !== undefined}
              onClick={() => setAdapterId("live_codex")}
            >
              Live Codex
            </button>
          </fieldset>

          {adapterId === "live_codex" && (
            <div className="foundry-live-consent">
              <p role="status">
                {checkingLive
                  ? "Checking local Codex availability..."
                  : liveAvailability?.available
                    ? `${liveAvailability.adapterVersion} is available for one bounded execution.`
                    : (liveAvailability?.message ?? "Live execution is unavailable. Prepared fallback remains ready.")}
              </p>
              <label>
                <input
                  type="checkbox"
                  checked={liveConsent}
                  disabled={pending !== undefined}
                  onChange={(event) => setLiveConsent(event.target.checked)}
                />
                Send this bounded task and declared capability context to Codex for this execution only.
              </label>
              <small>
                Credentials and the canonical ledger are excluded. A live failure is recorded before fallback.
              </small>
            </div>
          )}

          <button
            type="button"
            className="primary-button"
            disabled={
              inputSummary.trim().length < 3 || pending !== undefined || (adapterId === "live_codex" && !liveConsent)
            }
            onClick={() => {
              const consentForRequest = liveConsent;
              if (adapterId === "live_codex") setLiveConsent(false);
              void execute("execute", () =>
                onExecute(capability.manifest.id, inputSummary, adapterId, consentForRequest)
              );
            }}
          >
            <Play size={15} />{" "}
            {pending === "execute" ? "Executing..." : `Run ${adapterId === "prepared" ? "prepared" : "live"}`}
          </button>
          {error && <p role="alert">{error}</p>}
        </div>
      )}

      {latestApplication && (
        <div className="foundry-feedback-form">
          <div className="foundry-application-result">
            <span>{latestApplication.outcome}</span>
            <strong>{latestApplication.outputSummary}</strong>
            <small>
              Requested {latestApplication.execution.requestedAdapter}; completed by{" "}
              {latestApplication.execution.completedAdapter}
              {latestApplication.execution.fallbackUsed ? " after fallback" : ""}.
            </small>
            <ol aria-label="Execution attempts">
              {latestApplication.execution.attempts.map((attempt) => (
                <li key={`${attempt.adapter}-${attempt.startedAt}`}>
                  <span>{attempt.adapter}</span>
                  <span>{attempt.status}</span>
                  <span>{attempt.durationMs} ms</span>
                  {attempt.error && <small>{attempt.error.message}</small>}
                </li>
              ))}
            </ol>
            <code>{latestApplication.evidenceEventId}</code>
          </div>
          <label htmlFor={`application-feedback-${capability.manifest.id}`}>Human practical feedback</label>
          <fieldset className="foundry-segmented" aria-label="Feedback evidence kind">
            {(Object.keys(feedbackLabels) as PracticalFeedbackKind[]).map((value) => (
              <button
                type="button"
                key={value}
                aria-pressed={feedbackKind === value}
                disabled={pending !== undefined}
                onClick={() => setFeedbackKind(value)}
              >
                {feedbackLabels[value]}
              </button>
            ))}
          </fieldset>
          <textarea
            id={`application-feedback-${capability.manifest.id}`}
            value={feedbackContent}
            maxLength={PRACTICAL_EVIDENCE_LIMITS.summaryCharacters}
            disabled={pending !== undefined}
            onChange={(event) => setFeedbackContent(event.target.value)}
          />
          {feedbackKind === "correction" && (
            <>
              <label htmlFor={`feedback-focus-${capability.manifest.id}`}>Theory revision focus</label>
              <select
                id={`feedback-focus-${capability.manifest.id}`}
                value={focusTheoryElementId}
                disabled={pending !== undefined}
                onChange={(event) => setFocusTheoryElementId(event.target.value)}
              >
                {capability.manifest.theoryElementIds.map((theoryElementId) => (
                  <option key={theoryElementId} value={theoryElementId}>
                    {theoryElementId.replace("theory-", "").replaceAll("-", " ")}
                  </option>
                ))}
              </select>
            </>
          )}
          {latestFeedback && <p className="foundry-saved-evidence">Latest feedback: {latestFeedback.kind}</p>}
          <button
            type="button"
            className="secondary-button"
            disabled={feedbackContent.trim().length < 3 || pending !== undefined}
            onClick={() =>
              void execute("feedback", () =>
                onFeedback(
                  latestApplication.evidenceEventId,
                  feedbackKind,
                  feedbackContent,
                  feedbackKind === "correction" ? focusTheoryElementId : undefined
                )
              )
            }
          >
            <MessageSquare size={15} /> {pending === "feedback" ? "Recording..." : "Append practical feedback"}
          </button>
        </div>
      )}
    </section>
  );
}
