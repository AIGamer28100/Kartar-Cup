import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { isHost as lookupSuperAdmin } from './db';
import { auth } from './firebase';
import { accessFor } from './roles';
import { ensureUserDoc, watchOwnUser } from './users';
const Ctx = createContext({ ready: false, user: null, isHost: undefined, access: undefined, hostError: null });
export const useAuth = () => useContext(Ctx);
export function AuthProvider({ children }) {
    const [ready, setReady] = useState(false);
    const [user, setUser] = useState(null);
    const [superAdmin, setSuperAdmin] = useState(null);
    const [profile, setProfile] = useState(null);
    useEffect(() => onAuthStateChanged(auth, (u) => {
        setUser(u && !u.isAnonymous ? u : null);
        setReady(true);
    }), []);
    const uid = user?.uid;
    const email = user?.email;
    // Super admin = a console-created hosts/{email} document. Cannot be changed from the app.
    useEffect(() => {
        if (!uid || !email)
            return;
        let cancelled = false;
        lookupSuperAdmin(email)
            .then((ok) => {
            if (!cancelled)
                setSuperAdmin({ uid, ok, err: null });
        })
            .catch((e) => {
            if (!cancelled)
                setSuperAdmin({ uid, ok: false, err: e instanceof Error ? e : new Error('Access check failed') });
        });
        return () => {
            cancelled = true;
        };
    }, [uid, email]);
    // Roles live on the person's own users/{uid} record, created on first sign-in with no roles.
    useEffect(() => {
        if (!uid || !user)
            return;
        let cancelled = false;
        let unsub = null;
        ensureUserDoc(user)
            .catch((e) => console.warn('[auth] could not save profile', e))
            .finally(() => {
            if (cancelled)
                return;
            unsub = watchOwnUser(uid, (u) => !cancelled && setProfile({ uid, roles: u?.roles ?? [] }), () => !cancelled && setProfile({ uid, roles: [] }));
        });
        return () => {
            cancelled = true;
            unsub?.();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [uid]);
    const value = useMemo(() => {
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
    return _jsx(Ctx.Provider, { value: value, children: children });
}
