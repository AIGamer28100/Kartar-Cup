import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { isHost as lookupSuperAdmin } from './db';
import { auth } from './firebase';
import { accessFor, type Access } from './roles';
import { ensureUserDoc, watchOwnUser } from './users';

interface AuthState {
  /** Auth state resolved (first onAuthStateChanged fired). */
  ready: boolean;
  /** Google user; stale anonymous sessions count as signed out (R14). */
  user: User | null;
  /** May enter the host area at all (any staff role). undefined while access is still loading. */
  isHost: boolean | undefined;
  /** Full capability set (super admin / admin / host / venue host); undefined while loading. */
  access: Access | undefined;
  hostError: Error | null;
}

const Ctx = createContext<AuthState>({ ready: false, user: null, isHost: undefined, access: undefined, hostError: null });

export const useAuth = (): AuthState => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [superAdmin, setSuperAdmin] = useState<{ uid: string; ok: boolean; err: Error | null } | null>(null);
  const [profile, setProfile] = useState<{ uid: string; roles: string[] } | null>(null);

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

  // Super admin = a console-created hosts/{email} document. Cannot be changed from the app.
  useEffect(() => {
    if (!uid || !email) return;
    let cancelled = false;
    lookupSuperAdmin(email)
      .then((ok) => {
        if (!cancelled) setSuperAdmin({ uid, ok, err: null });
      })
      .catch((e: unknown) => {
        if (!cancelled) setSuperAdmin({ uid, ok: false, err: e instanceof Error ? e : new Error('Access check failed') });
      });
    return () => {
      cancelled = true;
    };
  }, [uid, email]);

  // Roles live on the person's own users/{uid} record, created on first sign-in with no roles.
  useEffect(() => {
    if (!uid || !user) return;
    let cancelled = false;
    let unsub: (() => void) | null = null;
    ensureUserDoc(user)
      .catch((e: unknown) => console.warn('[auth] could not save profile', e))
      .finally(() => {
        if (cancelled) return;
        unsub = watchOwnUser(
          uid,
          (u) => !cancelled && setProfile({ uid, roles: u?.roles ?? [] }),
          () => !cancelled && setProfile({ uid, roles: [] }),
        );
      });
    return () => {
      cancelled = true;
      unsub?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  const value = useMemo<AuthState>(() => {
    const sa = superAdmin && superAdmin.uid === uid ? superAdmin : null;
    const pr = profile && profile.uid === uid ? profile : null;
    const access = user && sa && pr ? accessFor(sa.ok, pr.roles) : undefined;
    return {
      ready,
      user,
      isHost: user ? access?.isStaff : false,
      access,
      hostError: sa?.err ?? null,
    };
  }, [ready, user, uid, superAdmin, profile]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
