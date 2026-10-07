import { useEffect, useState } from 'react';
import { watchActiveEventConfig, watchEntries, watchResults } from '../lib/db';
import type { Entry, EventConfig, Results, ResultsDoc } from '../lib/types';

export const EMPTY_RESULTS: Results = { q1: [], q2: [], q3: [], q4: [], q5: [] };

export interface HostData {
  loading: boolean;
  error: string | null;
  /** Full config of the live event (its own questions/teams/drivers), null when none is live. */
  config: EventConfig | null;
  entries: Entry[];
  resultsDoc: ResultsDoc | null;
  results: Results;
}

export function useHostData(): HostData {
  const [config, setConfig] = useState<EventConfig | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [resultsDoc, setResultsDoc] = useState<ResultsDoc | null>(null);
  const [ready, setReady] = useState({ config: false, entries: false });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fail = (err: Error) => setError(err.message);
    const u2 = watchEntries((e) => {
      setEntries(e);
      setReady((r) => ({ ...r, entries: true }));
    }, fail);
    const u3 = watchResults(setResultsDoc, (err) => setError(err.message));
    const u4 = watchActiveEventConfig((c) => {
      setConfig(c);
      setReady((r) => ({ ...r, config: true }));
    }, fail);
    return () => {
      u2();
      u3();
      u4();
    };
  }, []);

  const base: Results = config
    ? Object.fromEntries(config.questionIds.map((id) => [id, [] as string[]]))
    : EMPTY_RESULTS;
  return {
    loading: !(ready.config && ready.entries),
    error,
    config,
    entries,
    resultsDoc,
    results: { ...base, ...(resultsDoc?.answers ?? {}) },
  };
}
