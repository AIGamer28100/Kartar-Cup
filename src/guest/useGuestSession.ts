import { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth, signInGoogle, signInGuest } from '../lib/firebase';
import { watchEvent, watchOwnEntry, watchResults, submitEntry } from '../lib/db';
import type { Answers, Entry, EventDoc, ResultsDoc } from '../lib/types';

export interface GuestSession {
  authReady: boolean;
  user: User | null;
  event: EventDoc | null | undefined; // undefined = still loading
  entry: Entry | null | undefined; // undefined = still loading
  pending: boolean;
  results: ResultsDoc | null;
  google: () => Promise<User>;
  guest: () => Promise<User>;
  submit: (a: { name: string; phone?: string; answers: Answers }) => Promise<void>;
}

export function useGuestSession(): GuestSession {
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [event, setEvent] = useState<EventDoc | null | undefined>(undefined);
  const [entry, setEntry] = useState<Entry | null | undefined>(undefined);
  const [pending, setPending] = useState(false);
  const [results, setResults] = useState<ResultsDoc | null>(null);

  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        setUser(u);
        setAuthReady(true);
      }),
    [],
  );

  useEffect(() => watchEvent(setEvent), []);

  const uid = user?.uid;
  useEffect(() => {
    setEntry(undefined);
    if (!uid) return;
    return watchOwnEntry(uid, (e, p) => {
      setEntry(e);
      setPending(p);
    });
  }, [uid]);

  const scored = event?.status === 'scored';
  useEffect(() => {
    if (!scored || !uid) return;
    return watchResults(setResults, () => setResults(null));
  }, [scored, uid]);

  const google = useCallback(async () => (await signInGoogle()).user, []);
  const guest = useCallback(async () => (await signInGuest()).user, []);

  const submit = useCallback(
    async (a: { name: string; phone?: string; answers: Answers }) => {
      const u = auth.currentUser;
      if (!u) throw new Error('not signed in');
      await submitEntry(
        {
          uid: u.uid,
          name: a.name,
          ...(u.email ? { email: u.email } : {}),
          ...(a.phone ? { phone: a.phone } : {}),
          provider: u.isAnonymous ? 'anonymous' : 'google',
          answers: a.answers,
        },
        !entry,
      );
    },
    [entry],
  );

  return { authReady, user, event, entry, pending, results, google, guest, submit };
}
