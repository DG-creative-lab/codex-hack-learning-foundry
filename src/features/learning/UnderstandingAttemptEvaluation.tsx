import { AlertCircle, Check, MessageSquareWarning, Send, X } from "lucide-react";
import { UNDERSTANDING_CHECK_LIMITS, type UnderstandingAttemptRecord } from "../../domain/understandingChecks";

const outcomeLabels = {
  supported: "Evidence supports",
  partial: "Partial evidence",
  needs_review: "Review needed"
} as const;

interface UnderstandingAttemptEvaluationProps {
  checkId: string;
  attempt: UnderstandingAttemptRecord;
  pending: boolean;
  disputeOpen: boolean;
  disputeReason: string;
  disputeCorrection: string;
  disputeValid: boolean;
  onOpenDispute: () => void;
  onCloseDispute: () => void;
  onReasonChange: (value: string) => void;
  onCorrectionChange: (value: string) => void;
  onSubmitDispute: () => void;
}

export function UnderstandingAttemptEvaluation({
  checkId,
  attempt,
  pending,
  disputeOpen,
  disputeReason,
  disputeCorrection,
  disputeValid,
  onOpenDispute,
  onCloseDispute,
  onReasonChange,
  onCorrectionChange,
  onSubmitDispute
}: UnderstandingAttemptEvaluationProps) {
  return (
    <section className="attempt-evaluation">
      <div className="check-section-heading">
        <p className="eyebrow">Attempt evidence</p>
        <span>{new Date(attempt.createdAt).toLocaleDateString()}</span>
      </div>
      <blockquote>{attempt.response.answer}</blockquote>
      <div className="response-meta">
        <span>Confidence: {attempt.response.confidence}</span>
        <span>Support: {attempt.response.sourceSupport.level}</span>
      </div>
      <div className={`evaluation-result outcome-${attempt.evaluation.outcome}`}>
        <div>
          {attempt.evaluation.outcome === "supported" ? <Check size={16} /> : <AlertCircle size={16} />}
          <strong>{outcomeLabels[attempt.evaluation.outcome]}</strong>
          <span>{attempt.evaluation.evaluator.replace("_", " ")}</span>
        </div>
        <p>{attempt.evaluation.feedback}</p>
      </div>
      {attempt.dispute ? (
        <div className="dispute-recorded">
          <MessageSquareWarning size={15} />
          <div>
            <strong>Evaluation disputed</strong>
            <p>{attempt.dispute.correction}</p>
          </div>
        </div>
      ) : (
        <button type="button" className="text-button dispute-trigger" disabled={pending} onClick={onOpenDispute}>
          <MessageSquareWarning size={14} /> Dispute evaluation
        </button>
      )}
      {disputeOpen && !attempt.dispute && (
        <div className="dispute-editor">
          <label htmlFor={`dispute-reason-${checkId}`}>What did the evaluation miss?</label>
          <textarea
            id={`dispute-reason-${checkId}`}
            value={disputeReason}
            maxLength={UNDERSTANDING_CHECK_LIMITS.correctionCharacters}
            onChange={(event) => onReasonChange(event.target.value)}
            rows={2}
          />
          <label htmlFor={`dispute-correction-${checkId}`}>Corrected interpretation</label>
          <textarea
            id={`dispute-correction-${checkId}`}
            value={disputeCorrection}
            maxLength={UNDERSTANDING_CHECK_LIMITS.correctionCharacters}
            onChange={(event) => onCorrectionChange(event.target.value)}
            rows={3}
          />
          <div>
            <button type="button" className="icon-button" title="Cancel dispute" onClick={onCloseDispute}>
              <X size={14} />
            </button>
            <button
              type="button"
              className="primary-button"
              disabled={!disputeValid || pending}
              onClick={onSubmitDispute}
            >
              <Send size={13} /> {pending ? "Recording..." : "Append correction"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
