import { deriveAgentMemory } from "./agentMemoryProjection";
import { deriveHumanMemory } from "./humanMemoryProjection";
import { latestTimestamp } from "./memoryProjectionSupport";
import type { MemoryProjections } from "./memoryProjectionTypes";
import type { MicroWorldProjection } from "./microWorld";
import { deriveSharedTheoryMemory } from "./sharedTheoryProjection";
import { type EvidenceEvent, evidenceEventSchema, type LivingTheory, livingTheorySchema } from "./types";
import type { UnderstandingCheckProjection } from "./understandingChecks";
import type { FoundryCapability } from "./workspaceEntities";

export * from "./memoryProjectionTypes";

interface MemoryProjectionInput {
  theory: LivingTheory;
  events: EvidenceEvent[];
  understandingChecks: UnderstandingCheckProjection[];
  microWorlds: MicroWorldProjection[];
  capabilities: FoundryCapability[];
}

export function deriveMemoryProjections(input: MemoryProjectionInput): MemoryProjections {
  const theory = livingTheorySchema.parse(input.theory);
  const events = evidenceEventSchema.array().parse(input.events);
  const asOf = latestTimestamp(events.map((event) => event.createdAt)) ?? new Date(0).toISOString();
  const eventsById = new Map(events.map((event) => [event.id, event]));
  const human = deriveHumanMemory(theory, eventsById, input.understandingChecks, input.microWorlds, asOf);
  const agent = deriveAgentMemory(theory, events, eventsById, input.capabilities, asOf);
  const shared = deriveSharedTheoryMemory(theory, eventsById, human, agent, asOf);

  return { asOf, human, agent, shared };
}
