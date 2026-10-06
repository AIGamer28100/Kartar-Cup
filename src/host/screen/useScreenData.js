import { useEffect, useMemo, useState } from 'react';
import { watchActiveEventId, watchEntries, watchEventConfig, watchResults, watchScreenState, } from '../../lib/db';
import { pointsMap, rankEntries } from '../../lib/scoring';
import { useCardBonus } from '../useCardBonus';
const SEALED = {
    mode: 'lobby',
    stage: 0,
    overrideUid: null,
    updatedAt: undefined,
};
/** Everything the big screen (and the PodiumController) need for the active event: config,
 * entries, ranked leaderboard (via rankEntries — never reimplemented), and host-controlled
 * screen/state. */
export function useScreenData() {
    const [eventId, setEventId] = useState(undefined);
    const [config, setConfig] = useState(null);
    const [entries, setEntries] = useState([]);
    const [results, setResults] = useState({});
    const [screenState, setScreenStateLocal] = useState(SEALED);
    const [ready, setReady] = useState({ event: false, entries: false });
    const [error, setError] = useState(null);
    const cardBonus = useCardBonus(config?.raceId);
    useEffect(() => watchActiveEventId(setEventId, (e) => setError(e.message)), []);
    useEffect(() => {
        if (eventId === undefined)
            return;
        if (eventId === null) {
            setConfig(null);
            setReady((r) => ({ ...r, event: true }));
            return;
        }
        const fail = (e) => setError(e.message);
        const u1 = watchEventConfig(eventId, (c) => {
            setConfig(c);
            setReady((r) => ({ ...r, event: true }));
        }, fail);
        const u2 = watchEntries((e) => {
            setEntries(e);
            setReady((r) => ({ ...r, entries: true }));
        }, fail);
        const u3 = watchResults((r) => setResults(r?.answers ?? {}), fail);
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
        return rankEntries(scorable, results, screenState.overrideUid, config?.questionIds, config ? pointsMap(config.questions) : undefined, cardBonus);
    }, [entries, results, screenState.overrideUid, config, cardBonus]);
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
