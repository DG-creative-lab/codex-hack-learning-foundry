import { Bot, History, Network, UserRound } from "lucide-react";
import { useMemo } from "react";
import type { MemoryProjections } from "../domain/memoryProjections";
import type { EvidenceEvent, EvidenceKind, LivingTheory } from "../domain/types";

const kindLabels: Record<EvidenceKind, string> = {
  source_fact: "Source fact",
  user_interpretation: "Human interpretation",
  agent_synthesis: "Agent synthesis",
  practical_observation: "Practical observation",
  hypothesis: "Hypothesis",
  validated_behavior: "Validated behavior"
};

interface MemoryViewProps {
  events: EvidenceEvent[];
  theory: LivingTheory;
  projections: MemoryProjections;
}

export function MemoryView({ events, theory, projections }: MemoryViewProps) {
  const eventRows = useMemo(() => [...events].reverse(), [events]);

  return (
    <div className="page-scroll memory-view">
      <section className="memory-model">
        <div className="memory-column human-memory">
          <UserRound size={21} />
          <p className="eyebrow">Human state</p>
          <h2>Understanding</h2>
          <ul>
            <li>{projections.human.theoryElementIds.length} shared theory references</li>
            <li>{projections.human.contributedTheoryElementIds.length} human contributions</li>
            <li>Recall and application evidence</li>
            <li>Misconceptions and corrections</li>
          </ul>
        </div>
        <div className="shared-memory">
          <Network size={24} />
          <p className="eyebrow">Derived shared theory</p>
          <h2>{theory.elements.length} theory elements</h2>
          <p>
            {theory.title} links purpose, concepts, boundaries, questions, and revisions to the canonical evidence
            ledger.
          </p>
          <div className="atom-cloud">
            {theory.elements.map((element) => (
              <span key={element.id} title={element.id} className={`kind-border-${element.epistemicKind}`}>
                {element.title}
              </span>
            ))}
          </div>
        </div>
        <div className="memory-column agent-memory">
          <Bot size={21} />
          <p className="eyebrow">Agent state</p>
          <h2>Capability</h2>
          <ul>
            <li>{projections.agent.theoryElementIds.length} shared theory references</li>
            <li>{projections.agent.contributedTheoryElementIds.length} agent contributions</li>
            <li>Evaluations and failures</li>
            <li>Capability versions</li>
          </ul>
        </div>
      </section>
      <section className="ledger-section">
        <div className="section-heading compact">
          <div>
            <p className="eyebrow">Append-only evidence ledger</p>
            <h2>{events.length} recorded events</h2>
          </div>
          <button type="button" className="secondary-button">
            <History size={14} /> Consolidation proposals
          </button>
        </div>
        <div className="ledger-head">
          <span>Time</span>
          <span>Epistemic class</span>
          <span>Event</span>
          <span>Actor</span>
        </div>
        {eventRows.map((event) => (
          <article key={event.id}>
            <time>
              {new Date(event.createdAt).toLocaleString([], {
                month: "short",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit"
              })}
            </time>
            <span className="ledger-kind">
              <i className={`kind-${event.kind}`} />
              {kindLabels[event.kind]}
            </span>
            <div>
              <strong>{event.type}</strong>
              <p>{event.summary}</p>
            </div>
            <span>{event.actor}</span>
          </article>
        ))}
      </section>
    </div>
  );
}
