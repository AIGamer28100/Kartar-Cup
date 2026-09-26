import { useEffect, useState } from 'react';
import { watchEntries, watchEvent, watchResults } from '../lib/db';
import type { Entry, EventDoc, Results, ResultsDoc } from '../lib/types';

export const EMPTY_RESULTS: Results = { q1: [], q2: [], q3: [], q4: [], q5: [] };

export interface HostData {
  loading: boolean;
  error: string | null;
  event: EventDoc | null;
  entries: Entry[];
  resultsDoc: ResultsDoc | null;
  results: Results;
}

export function useHostData(): HostData {
  const [event, setEvent] = useState<EventDoc | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [resultsDoc, setResultsDoc] = useState<ResultsDoc | null>(null);
  const [ready, setReady] = useState({ event: false, entries: false });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const u1 = watchEvent((e) => {
      setEvent(e);
      setReady((r) => ({ ...r, event: true }));
    });
    const u2 = watchEntries((e) => {
      setEntries(e);
      setReady((r) => ({ ...r, entries: true }));
    });
    const u3 = watchResults(setResultsDoc, (err) => setError(err.message));
    return () => {
      u1();
      u2();
      u3();
    };
  }, []);

  return {
    loading: !(ready.event && ready.entries),
    error,
    event,
    entries,
    resultsDoc,
    results: { ...EMPTY_RESULTS, ...(resultsDoc?.answers ?? {}) },
  };
}
