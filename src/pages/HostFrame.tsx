import type { ReactNode } from 'react';
import { SignOut } from '@phosphor-icons/react';
import { Link } from 'react-router';
import { buttonCls } from '../components/Button';
import { SITE_TITLE } from '../config/event';

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
