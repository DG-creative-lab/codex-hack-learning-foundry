import { Bot, History, Network, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import type { MemoryProjections } from "../domain/memoryProjections";
import type { EvidenceEvent, EvidenceKind, LivingTheory } from "../domain/types";
import { AgentMemoryProjectionView } from "../features/memory/AgentMemoryProjectionView";
import { HumanMemoryProjectionView } from "../features/memory/HumanMemoryProjectionView";
import "../features/memory/memory.css";
import { SharedTheoryProjectionView } from "../features/memory/SharedTheoryProjectionView";

const kindLabels: Record<EvidenceKind, string> = {
  source_fact: "Source fact",
  user_interpretation: "Human interpretation",
  agent_synthesis: "Agent synthesis",
  practical_observation: "Practical observation",
  hypothesis: "Hypothesis",
  validated_behavior: "Validated behavior"
};

type ProjectionId = "human" | "agent" | "shared";

interface MemoryViewProps {
  events: EvidenceEvent[];
  theory: LivingTheory;
  projections: MemoryProjections;
}

export function MemoryView({ events, theory, projections }: MemoryViewProps) {
  const [selectedProjection, setSelectedProjection] = useState<ProjectionId>("human");
  const eventRows = useMemo(() => [...events].reverse(), [events]);
  const tabs = [
    {
      id: "human" as const,
      label: "Human understanding",
      meta: `${projections.human.supportingEvidence.length + projections.human.mixedEvidence.length + projections.human.contradictoryEvidence.length} evidence signals`,
      icon: UserRound
    },
    {
      id: "agent" as const,
      label: "Agent memory",
      meta: `${projections.agent.capabilityVersions.length} capability versions`,
      icon: Bot
    },
    {
      id: "shared" as const,
      label: "Shared theory",
      meta: `${projections.shared.unresolvedTheoryElementIds.length} unresolved`,
      icon: Network
    }
  ];

  return (
    <div className="page-scroll memory-view">
      <section className="memory-introduction">
        <div>
          <p className="eyebrow">Distinct projections / one canonical ledger</p>
          <h2>Evidence without a mastery score.</h2>
        </div>
        <div>
          <p>{theory.title}</p>
          <span>As of {new Date(projections.asOf).toLocaleString()}</span>
        </div>
      </section>

      <div className="memory-projection-tabs" role="tablist" aria-label="Memory projection">
        {tabs.map((tab, index) => {
          const Icon = tab.icon;
          const selected = tab.id === selectedProjection;
          return (
            <button
              type="button"
              key={tab.id}
              id={`memory-tab-${tab.id}`}
              role="tab"
              aria-selected={selected}
              aria-controls={`memory-panel-${tab.id}`}
              className={selected ? "selected" : ""}
              onClick={() => setSelectedProjection(tab.id)}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <Icon size={18} />
              <strong>{tab.label}</strong>
              <small>{tab.meta}</small>
            </button>
          );
        })}
      </div>

      {selectedProjection === "human" && <HumanMemoryProjectionView projection={projections.human} />}
      {selectedProjection === "agent" && <AgentMemoryProjectionView projection={projections.agent} />}
      {selectedProjection === "shared" && <SharedTheoryProjectionView projection={projections.shared} />}

      <section className="ledger-section memory-ledger">
        <div className="section-heading compact">
          <div>
            <p className="eyebrow">Canonical append-only evidence</p>
            <h2>{events.length} recorded events</h2>
          </div>
          <History size={18} aria-hidden="true" />
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
