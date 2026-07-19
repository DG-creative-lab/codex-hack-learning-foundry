import type { MicroWorldProjection, MicroWorldVariableValues } from "../../domain/microWorld";

interface DensityQueueStageProps {
  artifact: MicroWorldProjection;
  values: MicroWorldVariableValues;
}

const queueItems = [
  { urgency: "Critical", title: "Payment retry spike", owner: "Revenue ops", age: "04m", region: "EU", risk: "High" },
  { urgency: "High", title: "Identity verification delay", owner: "Trust", age: "11m", region: "UK", risk: "Medium" },
  { urgency: "High", title: "Fulfilment exception", owner: "Logistics", age: "18m", region: "US", risk: "Medium" },
  { urgency: "Normal", title: "Account metadata mismatch", owner: "Support", age: "31m", region: "EU", risk: "Low" },
  { urgency: "Normal", title: "Duplicate notification", owner: "Messaging", age: "42m", region: "APAC", risk: "Low" }
];

export function DensityQueueStage({ artifact, values }: DensityQueueStageProps) {
  const spacing = artifact.variables.find((variable) => variable.role === "spacing");
  const hierarchy = artifact.variables.find((variable) => variable.role === "hierarchy");
  const information = artifact.variables.find((variable) => variable.role === "information_density");
  const spacingValue = spacing ? (values[spacing.id] ?? spacing.initialValue) : 16;
  const hierarchyValue = hierarchy ? (values[hierarchy.id] ?? hierarchy.initialValue) : 60;
  const informationValue = information ? (values[information.id] ?? information.initialValue) : 5;

  return (
    <section className="micro-world-stage" aria-label="Live queue simulation">
      <div className="queue-toolbar">
        <div>
          <span>Live queue</span>
          <strong>Priority review</strong>
        </div>
        <span>{queueItems.length} open</span>
      </div>
      <section className="queue-table" aria-label="Simulated operational queue">
        {queueItems.map((item, index) => (
          <article
            key={item.title}
            className={`queue-row urgency-${item.urgency.toLowerCase()}`}
            style={{ paddingBlock: spacingValue, minHeight: Math.max(48, 34 + spacingValue * 2) }}
          >
            <span className="queue-rank">{String(index + 1).padStart(2, "0")}</span>
            <div>
              <strong style={{ fontWeight: Math.round(480 + hierarchyValue * 2.2) }}>{item.title}</strong>
              <span>{item.owner}</span>
            </div>
            {informationValue >= 4 && <span>{item.urgency}</span>}
            {informationValue >= 5 && <span>{item.age}</span>}
            {informationValue >= 6 && <span>{item.region}</span>}
            {informationValue >= 7 && <span>{item.risk}</span>}
            <button type="button" aria-label={`Open ${item.title}`}>
              Open
            </button>
          </article>
        ))}
      </section>
    </section>
  );
}
