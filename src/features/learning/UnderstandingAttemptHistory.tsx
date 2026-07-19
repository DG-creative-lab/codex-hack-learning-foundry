import type { UnderstandingAttemptRecord } from "../../domain/understandingChecks";

interface UnderstandingAttemptHistoryProps {
  attempts: UnderstandingAttemptRecord[];
  selectedAttemptEventId?: string;
  onSelect: (attemptEventId: string) => void;
}

export function UnderstandingAttemptHistory({
  attempts,
  selectedAttemptEventId,
  onSelect
}: UnderstandingAttemptHistoryProps) {
  return (
    <nav className="attempt-history" aria-label="Response history">
      <p className="eyebrow">Response history</p>
      <div>
        {attempts.map((attempt, index) => (
          <button
            type="button"
            key={attempt.eventId}
            aria-pressed={selectedAttemptEventId === attempt.eventId}
            onClick={() => onSelect(attempt.eventId)}
          >
            <span>Attempt {String(index + 1).padStart(2, "0")}</span>
            <strong>{attempt.dispute ? "Disputed" : attempt.evaluation.outcome.replace("_", " ")}</strong>
            <time dateTime={attempt.createdAt}>{new Date(attempt.createdAt).toLocaleDateString()}</time>
          </button>
        ))}
      </div>
    </nav>
  );
}
