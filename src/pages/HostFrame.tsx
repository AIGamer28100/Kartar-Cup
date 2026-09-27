import type { ReactNode } from 'react';
import { GoogleLogo, SignOut } from '@phosphor-icons/react';
import { Link } from 'react-router';
import Button, { buttonCls } from '../components/Button';
import { SITE_TITLE } from '../config/event';
import { signInGoogle } from '../lib/firebase';
import { useState } from 'react';

/** Host page chrome: title bar with a Sign out link (when signed in). */
export function HostFrame({ children, signedIn }: { children: ReactNode; signedIn: boolean }) {
  return (
    <main className="mx-auto min-h-[100dvh] max-w-[87.5rem] bg-base px-6 py-8 text-ink md:px-10 lg:px-16">
      <header className="flex items-center justify-between gap-4 border-b border-line pb-4">
        <h1 className="text-2xl font-semibold md:text-4xl">
          {SITE_TITLE} <span className="text-muted">pit wall</span>
        </h1>
        {signedIn && (
          <Link to="/logout" className={buttonCls('ghost', 'whitespace-nowrap')}>
            <SignOut size={20} weight="regular" aria-hidden="true" /> Sign out
          </Link>
        )}
      </header>
      {children}
    </main>
  );
}

/** Signed-out host gate: Google sign-in in place, no redirect. */
export function HostGate() {
  const [err, setErr] = useState<string | null>(null);
  async function signIn() {
    setErr(null);
    try {
      await signInGoogle();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Sign-in failed. Try again.');
    }
  }
  return (
    <div className="py-16">
      <p className="max-w-2xl text-[clamp(1.75rem,3.5vw,3rem)] leading-tight">
        Marshals only. Show your credentials at the gate.
      </p>
      <Button className="mt-8" onClick={() => void signIn()}>
        <GoogleLogo size={20} weight="regular" aria-hidden="true" /> Continue with Google
      </Button>
      {err && (
        <p role="alert" className="mt-4 text-accent">
          {err}
        </p>
      )}
    </div>
  );
}
