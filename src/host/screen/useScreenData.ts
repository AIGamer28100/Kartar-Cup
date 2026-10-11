import { useEffect, useMemo, useState } from 'react';
import {
  watchActiveEventId,
  watchEntries,
  watchEventConfig,
  watchActiveResults,
  watchScreenState,
} from '../../lib/db';
import { rankWithFixes } from '../../lib/scoring';
import type { Entry, EventConfig, RankedRow, ResultsDoc, ScreenState } from '../../lib/types';

export interface ScreenData {
  loading: boolean;
  error: string | null;
  eventId: string | null;
  config: EventConfig | null;
  entries: Entry[];
  ranked: RankedRow[];
  screenState: ScreenState;
  entryCount: number;
}

const SEALED: ScreenState = {
  mode: 'lobby',
  stage: 0,
  overrideUid: null,
};

/** Everything the big screen (and the PodiumController) need for the active event: config,
 * entries, ranked leaderboard (via rankWithFixes — never reimplemented), and host-controlled
 * screen/state. */
export function useScreenData(): ScreenData {
  const [eventId, setEventId] = useState<string | null | undefined>(undefined);
  const [config, setConfig] = useState<EventConfig | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [resultsDoc, setResultsDoc] = useState<ResultsDoc | null>(null);
  const [screenState, setScreenStateLocal] = useState<ScreenState>(SEALED);
  const [ready, setReady] = useState({ event: false, entries: false });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => watchActiveEventId(setEventId, (e) => setError(e.message)), []);

  useEffect(() => {
    if (eventId === undefined) return;
    if (eventId === null) {
      setConfig(null);
      setReady((r) => ({ ...r, event: true }));
      return;
    }
    const fail = (e: Error) => setError(e.message);
    const u1 = watchEventConfig(
      eventId,
      (c) => {
        setConfig(c);
        setReady((r) => ({ ...r, event: true }));
      },
      fail,
    );
    const u2 = watchEntries((e) => {
      setEntries(e);
      setReady((r) => ({ ...r, entries: true }));
    }, fail);
    const u3 = watchActiveResults(setResultsDoc, fail);
    const u4 = watchScreenState(eventId, setScreenStateLocal, fail);
    return () => {
      u1();
      u2();
      u3();
      u4();
    };
  }, [eventId]);

  const ranked = useMemo(() => {
    const scorable = entries.map((e) => ({
      uid: e.uid,
      name: e.name,
      photoURL: e.photoURL,
      answers: e.answers,
      submittedAtMs: e.submittedAt.toMillis(),
    }));
    return rankWithFixes(scorable, resultsDoc?.answers ?? {}, screenState.overrideUid, config, resultsDoc);
  }, [entries, resultsDoc, screenState.overrideUid, config]);

  return {
    loading: eventId === undefined || !(ready.event && ready.entries),
    error,
    eventId: eventId ?? null,
    config,
    entries,
    ranked,
    screenState,
    entryCount: entries.length,
  };
}
