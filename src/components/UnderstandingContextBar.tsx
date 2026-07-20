import { ArrowLeft } from "lucide-react";

interface UnderstandingContextBarProps {
  contextTitle: string;
  onReturnToTheory: () => void;
}

export function UnderstandingContextBar({ contextTitle, onReturnToTheory }: UnderstandingContextBarProps) {
  return (
    <section className="understanding-action-context" aria-label="Understanding context">
      <button type="button" onClick={onReturnToTheory}>
        <ArrowLeft size={15} aria-hidden="true" /> Living Theory
      </button>
      <span>{contextTitle}</span>
    </section>
  );
}
