import { ArrowRight, BookOpen, CircleHelp, Clock3, GitBranch, MemoryStick, Wrench } from "lucide-react";
import type { TheoryElement } from "../../domain/types";
import type { UnderstandingNextAction } from "./understandingModel";

interface UnderstandingActionRailProps {
  nextAction: UnderstandingNextAction;
  questions: TheoryElement[];
  evidenceCount: number;
  onOpenNextAction: () => void;
  onSelectQuestion: (elementId: string) => void;
}

export function UnderstandingActionRail({
  nextAction,
  questions,
  evidenceCount,
  onOpenNextAction,
  onSelectQuestion
}: UnderstandingActionRailProps) {
  return (
    <aside className="understanding-action-rail">
      <section className="next-action">
        <p className="eyebrow">Next meaningful action</p>
        <h3>{nextAction.title}</h3>
        <p>{nextAction.why}</p>
        <button type="button" onClick={onOpenNextAction}>
          <span>{nextAction.label}</span>
          <ArrowRight size={15} aria-hidden="true" />
        </button>
      </section>

      <section className="open-questions">
        <div className="understanding-section-title">
          <h4>Open questions</h4>
          <span>{questions.length}</span>
        </div>
        {questions.length === 0 ? (
          <p className="understanding-empty-line">No explicit questions are recorded.</p>
        ) : (
          questions.slice(0, 4).map((question) => (
            <button type="button" key={question.id} onClick={() => onSelectQuestion(question.id)}>
              <CircleHelp size={14} aria-hidden="true" />
              <span>{question.title}</span>
            </button>
          ))
        )}
      </section>

      <section className="participation-loop" aria-label="Participation loop">
        <div>
          <BookOpen size={15} />
          <span>Source</span>
        </div>
        <div>
          <GitBranch size={15} />
          <span>Theory</span>
        </div>
        <div>
          <MemoryStick size={15} />
          <span>Evidence</span>
        </div>
        <div>
          <Wrench size={15} />
          <span>Capability</span>
        </div>
      </section>

      <p className="understanding-as-of">
        <Clock3 size={13} /> Derived from {evidenceCount} canonical events
      </p>
    </aside>
  );
}
