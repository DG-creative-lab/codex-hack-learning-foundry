import { AlertCircle, X } from "lucide-react";
import { useState } from "react";
import {
  type ProjectedReviewItem,
  type ResponseConfidence,
  type SourceSupportLevel,
  UNDERSTANDING_CHECK_LIMITS,
  type UnderstandingCheckProjection
} from "../../domain/understandingChecks";
import type {
  DisputeUnderstandingEvaluation,
  EvidenceVectorIndex,
  RecordCheckPreference,
  RecordUnderstandingResponse,
  SourceIndex
} from "./types";
import { UnderstandingAttemptEvaluation } from "./UnderstandingAttemptEvaluation";
import { UnderstandingCheckInspector } from "./UnderstandingCheckInspector";
import { UnderstandingEvidenceVector } from "./UnderstandingEvidenceVector";
import { UnderstandingResponseComposer } from "./UnderstandingResponseComposer";

const checkLabels = {
  recall: "Recall",
  explanation: "Explanation",
  prediction: "Prediction",
  teach_back: "Teach-back",
  transfer: "Transfer"
} as const;

interface UnderstandingCheckPreviewProps {
  check: UnderstandingCheckProjection;
  vectorsByTheoryId: EvidenceVectorIndex;
  reviewItems: ProjectedReviewItem[];
  sourcesById: SourceIndex;
  onResponse: RecordUnderstandingResponse;
  onDispute: DisputeUnderstandingEvaluation;
  onPreference: RecordCheckPreference;
}

export function UnderstandingCheckPreview({
  check,
  vectorsByTheoryId,
  reviewItems,
  sourcesById,
  onResponse,
  onDispute,
  onPreference
}: UnderstandingCheckPreviewProps) {
  const [answer, setAnswer] = useState("");
  const [confidence, setConfidence] = useState<ResponseConfidence>("medium");
  const [supportLevel, setSupportLevel] = useState<SourceSupportLevel>("reasoned");
  const [selectedSourceId, setSelectedSourceId] = useState(check.sourceIds[0] ?? "");
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeCorrection, setDisputeCorrection] = useState("");
  const [pendingCommand, setPendingCommand] = useState<string>();
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState<string>();
  const latestAttempt = check.attempts.at(-1);
  const answerValid = answer.trim().length >= 3 && answer.length <= UNDERSTANDING_CHECK_LIMITS.answerCharacters;
  const disputeValid = disputeReason.trim().length >= 3 && disputeCorrection.trim().length >= 3;

  async function execute(label: string, action: () => Promise<void>): Promise<boolean> {
    if (pendingCommand) return false;
    setPendingCommand(label);
    setError(undefined);
    setSaved(undefined);
    try {
      await action();
      setSaved(label);
      window.setTimeout(() => setSaved(undefined), 1800);
      return true;
    } catch {
      setError("This evidence could not be recorded. Nothing was saved; please try again.");
      return false;
    } finally {
      setPendingCommand(undefined);
    }
  }

  async function submitResponse() {
    if (!answerValid || check.status === "rejected") return;
    const recorded = await execute("response", () =>
      onResponse(check.id, {
        answer,
        confidence,
        sourceSupport: {
          level: supportLevel,
          sourceIds: supportLevel === "cited" && selectedSourceId ? [selectedSourceId] : [],
          fragmentIds: []
        }
      })
    );
    if (recorded) setAnswer("");
  }

  async function submitDispute() {
    if (!latestAttempt || !disputeValid || latestAttempt.dispute) return;
    const recorded = await execute("dispute", () =>
      onDispute(check.id, {
        attemptEventId: latestAttempt.eventId,
        reason: disputeReason,
        correction: disputeCorrection
      })
    );
    if (recorded) {
      setDisputeOpen(false);
      setDisputeReason("");
      setDisputeCorrection("");
    }
  }

  function recordPreference(preference: "more_like_this" | "different_angle" | "reject") {
    void execute("preference", () =>
      onPreference(check.id, {
        preference,
        reason: preference === "reject" ? "Learner rejected this check pattern." : undefined
      })
    );
  }

  return (
    <div className="understanding-check-preview" aria-busy={Boolean(pendingCommand)}>
      <header className="check-titlebar">
        <div>
          <div className="check-type-line">
            <span>{checkLabels[check.kind]}</span>
            <span>Cue {check.sequence.toString().padStart(2, "0")}</span>
            {check.status === "rejected" && <strong>Rejected</strong>}
          </div>
          <h2>{check.prompt}</h2>
          <p>{check.purpose}</p>
        </div>
      </header>

      <div className="check-context">
        <span>Active project</span>
        <p>{check.projectContext}</p>
      </div>

      {error && (
        <div className="feedback-error" role="alert">
          <AlertCircle size={15} />
          <span>{error}</span>
          <button type="button" className="icon-button" title="Dismiss error" onClick={() => setError(undefined)}>
            <X size={14} />
          </button>
        </div>
      )}

      <div className="check-body-grid">
        <div className="check-main-column">
          {latestAttempt && (
            <UnderstandingAttemptEvaluation
              checkId={check.id}
              attempt={latestAttempt}
              pending={pendingCommand === "dispute"}
              disputeOpen={disputeOpen}
              disputeReason={disputeReason}
              disputeCorrection={disputeCorrection}
              disputeValid={disputeValid}
              onOpenDispute={() => setDisputeOpen(true)}
              onCloseDispute={() => setDisputeOpen(false)}
              onReasonChange={setDisputeReason}
              onCorrectionChange={setDisputeCorrection}
              onSubmitDispute={() => void submitDispute()}
            />
          )}
          <UnderstandingResponseComposer
            check={check}
            sourcesById={sourcesById}
            answer={answer}
            confidence={confidence}
            supportLevel={supportLevel}
            selectedSourceId={selectedSourceId}
            pending={pendingCommand === "response"}
            answerValid={answerValid}
            onAnswerChange={setAnswer}
            onConfidenceChange={setConfidence}
            onSupportLevelChange={setSupportLevel}
            onSourceChange={setSelectedSourceId}
            onSubmit={() => void submitResponse()}
          />
          <UnderstandingEvidenceVector
            theoryElementIds={check.theoryElementIds}
            vectorsByTheoryId={vectorsByTheoryId}
          />
        </div>
        <UnderstandingCheckInspector
          check={check}
          reviewItems={reviewItems}
          sourcesById={sourcesById}
          pending={pendingCommand === "preference"}
          saved={saved}
          onPreference={recordPreference}
        />
      </div>
    </div>
  );
}
