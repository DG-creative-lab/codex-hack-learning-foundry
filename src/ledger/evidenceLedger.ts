import { type EvidenceEvent, evidenceEventSchema } from "../domain/types";

export interface StoredEvents {
  events: EvidenceEvent[];
  rejectedCount: number;
}

export interface EvidenceMemory {
  load: () => Promise<StoredEvents>;
  append: (event: EvidenceEvent) => Promise<unknown>;
  reset: () => Promise<unknown>;
}

export class EvidenceLedger {
  private currentEvents: EvidenceEvent[];
  private operationQueue: Promise<void> = Promise.resolve();
  private readonly seedEvents: EvidenceEvent[];
  private readonly seedIds: Set<string>;

  constructor(
    private readonly memory: EvidenceMemory,
    seedEvents: EvidenceEvent[]
  ) {
    this.seedEvents = evidenceEventSchema.array().parse(seedEvents);
    this.currentEvents = [...this.seedEvents];
    this.seedIds = new Set(this.seedEvents.map((event) => event.id));
    if (this.seedIds.size !== this.seedEvents.length) throw new Error("Seed evidence event IDs must be unique");
  }

  get events(): EvidenceEvent[] {
    return [...this.currentEvents];
  }

  load(): Promise<StoredEvents> {
    return this.enqueue(async () => {
      const stored = await this.memory.load();
      const runtimeEvents = evidenceEventSchema.array().parse(stored.events);
      this.assertUniqueIds(runtimeEvents);

      const seedCollision = runtimeEvents.find((event) => this.seedIds.has(event.id));
      if (seedCollision) throw new Error(`Stored evidence event ID ${seedCollision.id} collides with a seed event`);

      this.currentEvents = [...this.seedEvents, ...runtimeEvents];
      return { events: this.events, rejectedCount: stored.rejectedCount };
    });
  }

  append(event: EvidenceEvent): Promise<EvidenceEvent[]> {
    const parsed = evidenceEventSchema.parse(event);
    return this.enqueue(async () => {
      if (this.currentEvents.some((current) => current.id === parsed.id)) {
        throw new Error(`Evidence event ID ${parsed.id} already exists`);
      }

      const runtimeEvents = [...this.currentEvents.filter((current) => !this.seedIds.has(current.id)), parsed];
      await this.memory.append(parsed);
      this.currentEvents = [...this.seedEvents, ...runtimeEvents];
      return this.events;
    });
  }

  reset(): Promise<EvidenceEvent[]> {
    return this.enqueue(async () => {
      await this.memory.reset();
      this.currentEvents = [...this.seedEvents];
      return this.events;
    });
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operationQueue.then(operation);
    this.operationQueue = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  }

  private assertUniqueIds(events: EvidenceEvent[]) {
    const ids = new Set<string>();
    for (const event of events) {
      if (ids.has(event.id)) throw new Error(`Stored evidence event ID ${event.id} is duplicated`);
      ids.add(event.id);
    }
  }
}
