import { useCallback, useEffect, useRef, useState } from "react";
import { evidenceEventSchema, type EvidenceEvent } from "../domain/types";
import { seedEvents } from "../data/sample";

const browserKey = "learning-foundry-events";

interface StoredEvents {
  events: EvidenceEvent[];
  rejectedCount: number;
}

function readBrowserEvents(): StoredEvents {
  const value = window.localStorage.getItem(browserKey);
  if (!value) return { events: [], rejectedCount: 0 };

  try {
    const result = evidenceEventSchema.array().safeParse(JSON.parse(value));
    if (result.success) return { events: result.data, rejectedCount: 0 };
  } catch {
    // The raw value is preserved below before the active ledger is cleared.
  }

  window.localStorage.setItem(`${browserKey}-rejected-${Date.now()}`, value);
  window.localStorage.removeItem(browserKey);
  return { events: [], rejectedCount: 1 };
}

export function useEvidenceLedger() {
  const [events, setEvents] = useState<EvidenceEvent[]>(seedEvents);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string>();
  const [rejectedCount, setRejectedCount] = useState(0);
  const eventsRef = useRef(events);
  const appendQueueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    async function load() {
      try {
        const stored = window.foundryMemory ? await window.foundryMemory.load() : readBrowserEvents();
        const nextEvents = [...seedEvents, ...stored.events];
        eventsRef.current = nextEvents;
        setEvents(nextEvents);
        setRejectedCount(stored.rejectedCount);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : String(loadError));
      } finally {
        setReady(true);
      }
    }
    void load();
  }, []);

  const append = useCallback((event: EvidenceEvent) => {
    const parsed = evidenceEventSchema.parse(event);
    const operation = appendQueueRef.current.then(async () => {
      const runtimeEvents = [
        ...eventsRef.current.filter((item) => !seedEvents.some((seed) => seed.id === item.id)),
        parsed
      ];

      try {
        if (window.foundryMemory) await window.foundryMemory.append(parsed);
        else window.localStorage.setItem(browserKey, JSON.stringify(runtimeEvents));
        const nextEvents = [...seedEvents, ...runtimeEvents];
        eventsRef.current = nextEvents;
        setEvents(nextEvents);
        setError(undefined);
      } catch (appendError) {
        setError(appendError instanceof Error ? appendError.message : String(appendError));
        throw appendError;
      }
    });

    appendQueueRef.current = operation.catch(() => undefined);
    return operation;
  }, []);

  const reset = useCallback(async () => {
    await appendQueueRef.current;
    if (window.foundryMemory) await window.foundryMemory.reset();
    window.localStorage.removeItem(browserKey);
    eventsRef.current = seedEvents;
    setEvents(seedEvents);
    setError(undefined);
    setRejectedCount(0);
  }, []);

  return { events, append, reset, ready, error, rejectedCount };
}
