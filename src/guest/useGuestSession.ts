import { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth, signInGoogle, signOutUser } from '../lib/firebase';
import { watchActiveEventId, watchEventConfig, watchOwnEntry, watchResults, submitEntry } from '../lib/db';
import { useEventStatus } from '../lib/eventStatus';
import type { Answers, DerivedStatus, Entry, EventConfig, ResultsDoc } from '../lib/types';
import type { PickMap } from './draft';

export interface GuestSession {
  authReady: boolean;
  user: User | null;
  event: EventConfig | null | undefined; // undefined = still loading, null = no live event
  status: DerivedStatus | null;
  entry: Entry | null | undefined; // undefined = still loading
  pending: boolean;
  results: ResultsDoc | null;
  google: () => Promise<User>;
  signOut: () => Promise<void>;
  submit: (a: { name: string; phone?: string; answers: PickMap }) => Promise<void>;
}

export function useGuestSession(): GuestSession {
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [eventId, setEventId] = useState<string | null | undefined>(undefined);
  const [event, setEvent] = useState<EventConfig | null | undefined>(undefined);
  const [entry, setEntry] = useState<Entry | null | undefined>(undefined);
  const [pending, setPending] = useState(false);
  const [results, setResults] = useState<ResultsDoc | null>(null);

  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        setUser(u && !u.isAnonymous ? u : null); // R14: Google only, stale anonymous sessions count as signed out
        setAuthReady(true);
      }),
    [],
  );

  useEffect(() => watchActiveEventId(setEventId, () => setEventId(null)), []);

  useEffect(() => {
    if (eventId === undefined) return;
    if (eventId === null) {
      setEvent(null);
      return;
    }
    setEvent(undefined);
    return watchEventConfig(eventId, setEvent, () => setEvent(null));
  }, [eventId]);

  const status = useEventStatus(event);

  const uid = user?.uid;
  useEffect(() => {
    setEntry(undefined);
    if (!uid) return;
    return watchOwnEntry(uid, (e, p) => {
      setEntry(e);
      setPending(p);
    });
  }, [uid, eventId]);

  const scored = status === 'scored';
  useEffect(() => {
    setResults(null);
    if (!scored || !uid) return;
    return watchResults(setResults, () => setResults(null));
  }, [scored, uid, eventId]);

  const google = useCallback(async () => (await signInGoogle()).user, []);
  const signOut = useCallback(() => signOutUser(), []);

  const submit = useCallback(
    async (a: { name: string; phone?: string; answers: PickMap }) => {
      const u = auth.currentUser;
      if (!u || u.isAnonymous || !u.email) throw new Error('not signed in');
      await submitEntry(
        {
          uid: u.uid,
          name: a.name,
          email: u.email,
          ...(a.phone ? { phone: a.phone } : {}),
          provider: 'google',
          answers: a.answers as unknown as Answers,
        },
        !entry,
      );
    },
    [entry],
  );

  return { authReady, user, event, status, entry, pending, results, google, signOut, submit };
}
