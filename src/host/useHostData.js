import { useEffect, useState } from 'react';
import { watchActiveEventConfig, watchEntries, watchEvent, watchResults } from '../lib/db';
export const EMPTY_RESULTS = { q1: [], q2: [], q3: [], q4: [], q5: [] };
export function useHostData() {
    const [event, setEvent] = useState(null);
    const [config, setConfig] = useState(null);
    const [entries, setEntries] = useState([]);
    const [resultsDoc, setResultsDoc] = useState(null);
    const [ready, setReady] = useState({ event: false, entries: false });
    const [error, setError] = useState(null);
    useEffect(() => {
        const fail = (err) => setError(err.message);
        const u1 = watchEvent((e) => {
            setEvent(e);
            setReady((r) => ({ ...r, event: true }));
        }, fail);
        const u2 = watchEntries((e) => {
            setEntries(e);
            setReady((r) => ({ ...r, entries: true }));
        }, fail);
        const u3 = watchResults(setResultsDoc, (err) => setError(err.message));
        const u4 = watchActiveEventConfig(setConfig, fail);
        return () => {
            u1();
            u2();
            u3();
            u4();
        };
    }, []);
    const base = config
        ? Object.fromEntries(config.questionIds.map((id) => [id, []]))
        : EMPTY_RESULTS;
    return {
        loading: !(ready.event && ready.entries),
        error,
        event,
        config,
        entries,
        resultsDoc,
        results: { ...base, ...(resultsDoc?.answers ?? {}) },
    };
}
