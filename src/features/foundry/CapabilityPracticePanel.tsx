import { MessageSquare, Play } from "lucide-react";
import { useState } from "react";
import type { FoundryCapability } from "../../domain/capability";
import {
  PRACTICAL_EVIDENCE_LIMITS,
  type PracticalApplication,
  type PracticalFeedback,
  type PracticalFeedbackKind,
  type PracticalOutcome
} from "../../domain/practicalEvidence";

interface CapabilityPracticePanelProps {
  capability: FoundryCapability;
  applications: PracticalApplication[];
  feedback: PracticalFeedback[];
  onApply: (
    capabilityId: string,
    inputSummary: string,
    outputSummary: string,
    outcome: PracticalOutcome
  ) => Promise<string>;
  onFeedback: (subjectEventId: string, kind: PracticalFeedbackKind, content: string) => Promise<string>;
}

const outcomeLabels: Record<PracticalOutcome, string> = {
  successful: "Successful",
  partial: "Partial",
  failed: "Failed"
};

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
  onApply,
  onFeedback
}: CapabilityPracticePanelProps) {
  const [inputSummary, setInputSummary] = useState("");
  const [outputSummary, setOutputSummary] = useState("");
  const [outcome, setOutcome] = useState<PracticalOutcome>("successful");
  const [feedbackKind, setFeedbackKind] = useState<PracticalFeedbackKind>("observation");
  const [feedbackContent, setFeedbackContent] = useState("");
  const [pending, setPending] = useState<"apply" | "feedback">();
  const [error, setError] = useState<string>();
  const latestApplication = applications.at(-1);
  const latestFeedback = feedback.filter((item) => item.subjectEventId === latestApplication?.evidenceEventId).at(-1);

  async function execute(kind: "apply" | "feedback", command: () => Promise<unknown>) {
    setPending(kind);
    setError(undefined);
    try {
      await command();
      if (kind === "apply") {
        setInputSummary("");
        setOutputSummary("");
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
          <h3 id={`practice-title-${capability.manifest.id}`}>Apply, observe, and correct</h3>
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
            onChange={(event) => setInputSummary(event.target.value)}
          />
          <label htmlFor={`application-output-${capability.manifest.id}`}>Observed result</label>
          <textarea
            id={`application-output-${capability.manifest.id}`}
            value={outputSummary}
            maxLength={PRACTICAL_EVIDENCE_LIMITS.summaryCharacters}
            onChange={(event) => setOutputSummary(event.target.value)}
          />
          <fieldset className="foundry-segmented" aria-label="Application outcome">
            {(Object.keys(outcomeLabels) as PracticalOutcome[]).map((value) => (
              <button type="button" key={value} aria-pressed={outcome === value} onClick={() => setOutcome(value)}>
                {outcomeLabels[value]}
              </button>
            ))}
          </fieldset>
          <button
            type="button"
            className="primary-button"
            disabled={inputSummary.trim().length < 3 || outputSummary.trim().length < 3 || pending !== undefined}
            onClick={() =>
              void execute("apply", () => onApply(capability.manifest.id, inputSummary, outputSummary, outcome))
            }
          >
            <Play size={15} /> {pending === "apply" ? "Recording..." : "Record application result"}
          </button>
        </div>
      )}

      {latestApplication && (
        <div className="foundry-feedback-form">
          <div className="foundry-application-result">
            <span>{latestApplication.outcome}</span>
            <strong>{latestApplication.outputSummary}</strong>
            <small>{latestApplication.evidenceEventId}</small>
          </div>
          <label htmlFor={`application-feedback-${capability.manifest.id}`}>Human practical feedback</label>
          <fieldset className="foundry-segmented" aria-label="Feedback evidence kind">
            {(Object.keys(feedbackLabels) as PracticalFeedbackKind[]).map((value) => (
              <button
                type="button"
                key={value}
                aria-pressed={feedbackKind === value}
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
            onChange={(event) => setFeedbackContent(event.target.value)}
          />
          {latestFeedback && <p className="foundry-saved-evidence">Latest feedback: {latestFeedback.kind}</p>}
          {error && <p role="alert">{error}</p>}
          <button
            type="button"
            className="secondary-button"
            disabled={feedbackContent.trim().length < 3 || pending !== undefined}
            onClick={() =>
              void execute("feedback", () =>
                onFeedback(latestApplication.evidenceEventId, feedbackKind, feedbackContent)
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
