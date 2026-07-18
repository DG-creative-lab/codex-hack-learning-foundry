import { useCallback, useEffect, useState } from "react";
import { seedEvents } from "../data/sample";
import type { EvidenceEvent } from "../domain/types";
import { createBrowserEvidenceMemory } from "../ledger/browserEvidenceMemory";
import { EvidenceLedger, type EvidenceMemory } from "../ledger/evidenceLedger";

function resolveMemory(): EvidenceMemory {
  const bridge = window.foundryMemory;
  if (!bridge) return createBrowserEvidenceMemory(window.localStorage);
  return {
    load: () => bridge.load(),
    append: (event) => bridge.append(event),
    reset: () => bridge.reset()
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function useEvidenceLedger() {
  const [ledger] = useState(() => new EvidenceLedger(resolveMemory(), seedEvents));
  const [events, setEvents] = useState<EvidenceEvent[]>(ledger.events);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string>();
  const [rejectedCount, setRejectedCount] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const stored = await ledger.load();
        if (active) {
          setEvents(stored.events);
          setRejectedCount(stored.rejectedCount);
        }
      } catch (loadError) {
        if (active) setError(errorMessage(loadError));
      } finally {
        if (active) setReady(true);
      }
    }
    void load();
    return () => { active = false; };
  }, [ledger]);

  const append = useCallback(async (event: EvidenceEvent) => {
    try {
      setEvents(await ledger.append(event));
      setError(undefined);
    } catch (appendError) {
      setError(errorMessage(appendError));
      throw appendError;
    }
  }, [ledger]);

  const reset = useCallback(async () => {
    try {
      setEvents(await ledger.reset());
      setError(undefined);
      setRejectedCount(0);
    } catch (resetError) {
      setError(errorMessage(resetError));
      throw resetError;
    }
  }, [ledger]);

  return { events, append, reset, ready, error, rejectedCount };
}
