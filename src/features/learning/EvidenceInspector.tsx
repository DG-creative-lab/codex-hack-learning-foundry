import { Check } from "lucide-react";
import type { ExplainerFeedbackRecord } from "../../domain/explainer";
import type { NormalizedSourceFragment } from "../../domain/sourcePipeline";
import type { SourceRecord } from "../../domain/workspaceEntities";

interface EvidenceInspectorProps {
  fragment?: NormalizedSourceFragment;
  source?: SourceRecord;
  feedback: ExplainerFeedbackRecord[];
  saved?: string;
}

export function EvidenceInspector({ fragment, source, feedback, saved }: EvidenceInspectorProps) {
  const latestDepth = [...feedback].reverse().find((item) => item.kind === "depth");
  const confusionCount = feedback.filter((item) => item.kind === "confusion").length;
  const correctionCount = feedback.filter((item) => item.kind === "correction").length;

  return (
    <aside className="explainer-inspector">
      <div className="inspector-block">
        <p className="eyebrow">Exact source context</p>
        {fragment ? (
          <>
            <strong>{source?.title}</strong>
            <span>{fragment.location.label}</span>
            <blockquote>{fragment.content}</blockquote>
            <small>{source?.provenance}</small>
          </>
        ) : (
          <p>Select a source marker to inspect its fragment.</p>
        )}
      </div>
      <div className="inspector-block feedback-summary">
        <p className="eyebrow">Learner evidence</p>
        <dl>
          <div>
            <dt>Confusion flags</dt>
            <dd>{confusionCount}</dd>
          </div>
          <div>
            <dt>Corrections</dt>
            <dd>{correctionCount}</dd>
          </div>
          <div>
            <dt>Depth request</dt>
            <dd>{latestDepth?.kind === "depth" ? latestDepth.depth : "None"}</dd>
          </div>
        </dl>
        {saved && (
          <p className="feedback-saved">
            <Check size={12} /> Evidence appended
          </p>
        )}
      </div>
    </aside>
  );
}
