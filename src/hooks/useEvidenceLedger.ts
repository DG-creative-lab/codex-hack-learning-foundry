import { useCallback, useEffect, useState } from "react";
import { evidenceEventSchema, type EvidenceEvent } from "../domain/types";
import { seedEvents } from "../data/sample";

const browserKey = "learning-foundry-events";

function readBrowserEvents(): EvidenceEvent[] {
  try {
    const value = window.localStorage.getItem(browserKey);
    return value ? evidenceEventSchema.array().parse(JSON.parse(value)) : [];
  } catch {
    return [];
  }
}

export function useEvidenceLedger() {
  const [events, setEvents] = useState<EvidenceEvent[]>(seedEvents);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function load() {
      const stored = window.foundryMemory ? await window.foundryMemory.load() : readBrowserEvents();
      const parsed = evidenceEventSchema.array().safeParse(stored);
      setEvents([...seedEvents, ...(parsed.success ? parsed.data : [])]);
      setReady(true);
    }
    void load();
  }, []);

  const append = useCallback(async (event: EvidenceEvent) => {
    const parsed = evidenceEventSchema.parse(event);
    setEvents((current) => {
      const runtimeEvents = [...current.filter((item) => !seedEvents.some((seed) => seed.id === item.id)), parsed];
      if (!window.foundryMemory) window.localStorage.setItem(browserKey, JSON.stringify(runtimeEvents));
      return [...seedEvents, ...runtimeEvents];
    });
    if (window.foundryMemory) await window.foundryMemory.append(parsed);
  }, []);

  const reset = useCallback(async () => {
    if (window.foundryMemory) await window.foundryMemory.reset();
    window.localStorage.removeItem(browserKey);
    setEvents(seedEvents);
  }, []);

  return { events, append, reset, ready };
}

