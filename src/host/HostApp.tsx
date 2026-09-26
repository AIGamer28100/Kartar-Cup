import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { GoogleLogo, SignOut } from '@phosphor-icons/react';
import Button from '../components/Button';
import Skeleton from '../components/Skeleton';
import { SITE_TITLE } from '../config/event';
import { isHost } from '../lib/db';
import { auth, signInGoogle, signOutUser } from '../lib/firebase';
import HostConsole from './HostConsole';
import SettingsPage from './settings/SettingsPage';

const onSettings = window.location.pathname.startsWith('/host/settings');

type Gate =
  | { s: 'loading' }
  | { s: 'signedOut' }
  | { s: 'denied' }
  | { s: 'error'; msg: string }
  | { s: 'ok' };

export default function HostApp() {
  const [gate, setGate] = useState<Gate>({ s: 'loading' });
  const [signInErr, setSignInErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const off = onAuthStateChanged(auth, (user: User | null) => {
      if (!user || !user.email || user.isAnonymous) {
        setGate({ s: 'signedOut' });
        return;
      }
      setGate({ s: 'loading' });
      isHost(user.email)
        .then((ok) => {
          if (!cancelled) setGate({ s: ok ? 'ok' : 'denied' });
        })
        .catch((e) => {
          if (!cancelled)
            setGate({ s: 'error', msg: e instanceof Error ? e.message : 'Could not check the list.' });
        });
    });
    return () => {
      cancelled = true;
      off();
    };
  }, []);

  async function signIn() {
    setSignInErr(null);
    try {
      await signInGoogle();
    } catch (e) {
      setSignInErr(e instanceof Error ? e.message : 'Sign-in failed. Try again.');
    }
  }

  return (
    <main className="mx-auto min-h-[100dvh] max-w-7xl bg-base px-5 py-8 text-ink md:px-10">
      <header className="flex items-center justify-between gap-4 border-b border-line pb-4">
        <h1 className="text-2xl font-semibold md:text-4xl">
          {SITE_TITLE} <span className="text-muted">pit wall</span>
        </h1>
        {gate.s === 'ok' && (
          <Button variant="ghost" className="whitespace-nowrap" onClick={() => void signOutUser()}>
            <SignOut size={20} weight="regular" /> Sign out
          </Button>
        )}
      </header>

      {gate.s === 'loading' && (
        <div className="mt-8 space-y-4" aria-busy="true">
          <Skeleton className="h-32" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      )}

      {gate.s === 'signedOut' && (
        <div className="py-16">
          <p className="max-w-xl text-3xl">Marshals only. Show your credentials at the gate.</p>
          <Button className="mt-8" onClick={signIn}>
            <GoogleLogo size={20} weight="regular" /> Sign in with Google
          </Button>
          {signInErr && (
            <p role="alert" className="mt-4 text-accent">
              {signInErr}
            </p>
          )}
        </div>
      )}

      {gate.s === 'denied' && (
        <div className="py-16">
          <p className="text-3xl">Not on the marshal list.</p>
          <p className="mt-2 text-muted">Wrong account? Swap it and try the gate again.</p>
          <Button variant="secondary" className="mt-8" onClick={() => void signOutUser()}>
            <SignOut size={20} weight="regular" /> Sign out
          </Button>
        </div>
      )}

      {gate.s === 'error' && (
        <div className="py-16">
          <p role="alert" className="text-3xl text-accent">
            Radio check failed.
          </p>
          <p className="mt-2 text-muted">{gate.msg}</p>
          <Button variant="secondary" className="mt-8" onClick={() => void signOutUser()}>
            Sign out
          </Button>
        </div>
      )}

      {gate.s === 'ok' && (
        <nav aria-label="Host sections" className="flex gap-2 border-b border-line py-2">
          <a
            href="/host"
            aria-current={onSettings ? undefined : 'page'}
            className="inline-flex min-h-11 items-center px-3 text-muted hover:text-ink aria-[current=page]:text-ink"
          >
            Console
          </a>
          <a
            href="/host/settings"
            aria-current={onSettings ? 'page' : undefined}
            className="inline-flex min-h-11 items-center px-3 text-muted hover:text-ink aria-[current=page]:text-ink"
          >
            Settings
          </a>
        </nav>
      )}
      {gate.s === 'ok' && (onSettings ? <SettingsPage /> : <HostConsole />)}
    </main>
  );
}
