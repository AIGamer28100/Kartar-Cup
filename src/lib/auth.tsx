import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { isHost as lookupHost } from './db';
import { auth } from './firebase';

interface AuthState {
  /** Auth state resolved (first onAuthStateChanged fired). */
  ready: boolean;
  /** Google user; stale anonymous sessions count as signed out (R14). */
  user: User | null;
  /** undefined while the host allowlist lookup is in flight. */
  isHost: boolean | undefined;
  hostError: Error | null;
}

const Ctx = createContext<AuthState>({ ready: false, user: null, isHost: undefined, hostError: null });

export const useAuth = (): AuthState => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [host, setHost] = useState<{ uid: string; ok: boolean; err: Error | null } | null>(null);

  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        setUser(u && !u.isAnonymous ? u : null);
        setReady(true);
      }),
    [],
  );

  const uid = user?.uid;
  const email = user?.email;
  useEffect(() => {
    if (!uid || !email) return;
    let cancelled = false;
    lookupHost(email)
      .then((ok) => {
        if (!cancelled) setHost({ uid, ok, err: null });
      })
      .catch((e: unknown) => {
        if (!cancelled) setHost({ uid, ok: false, err: e instanceof Error ? e : new Error('Host check failed') });
      });
    return () => {
      cancelled = true;
    };
  }, [uid, email]);

  const value = useMemo<AuthState>(() => {
    const mine = host && host.uid === uid ? host : null;
    return {
      ready,
      user,
      isHost: user ? (mine ? mine.ok : undefined) : false,
      hostError: mine?.err ?? null,
    };
  }, [ready, user, uid, host]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
