import type { ReactNode } from 'react';
import { House, SignOut } from '@phosphor-icons/react';
import { Link } from 'react-router';
import { buttonCls } from '../components/Button';
import { SITE_TITLE } from '../config/event';

/** Host page chrome: title bar with a Back to site link and a Sign out link (when signed in). */
export function HostFrame({
  children,
  signedIn,
  leading,
  aside,
  drawerOpen = false,
}: {
  children: ReactNode;
  signedIn: boolean;
  /** Header start slot (the drawer's burger). */
  leading?: ReactNode;
  /** Rendered as a sibling of <main>, outside its padding and max-width (the fixed nav drawer). */
  aside?: ReactNode;
  /** At md+ the content is pushed right by the drawer width while this is true. */
  drawerOpen?: boolean;
}) {
  return (
    <>
      <div
        className={`min-h-[100dvh] bg-base md:transition-[padding] md:duration-150 md:ease-out motion-reduce:transition-none ${
          drawerOpen ? 'md:pl-64' : ''
        }`}
      >
      <main className="mx-auto min-h-[100dvh] max-w-[100rem] bg-base px-4 py-4 text-ink sm:px-6 md:px-8 lg:px-10">
        <header className="flex items-center gap-2 border-b border-line pb-3">
          {leading}
          <h1 className="min-w-0 flex-1 truncate text-lg font-semibold md:text-2xl">
            {/* "pit wall" is the first thing to go when the drawer is open on a narrow screen:
                dropping the subtitle keeps the actual title readable instead of truncating it. */}
            {SITE_TITLE} <span className="hidden text-muted lg:inline">pit wall</span>
          </h1>
          <div className="flex shrink-0 items-center">
            <Link to="/" aria-label="Back to site" className={buttonCls('ghost', 'min-h-11! whitespace-nowrap px-3! text-sm!')}>
              <House size={20} weight="regular" aria-hidden="true" /> <span className="hidden sm:inline">Back to site</span>
            </Link>
            {signedIn && (
              <Link to="/logout" aria-label="Sign out" className={buttonCls('ghost', 'min-h-11! whitespace-nowrap px-3! text-sm!')}>
                <SignOut size={20} weight="regular" aria-hidden="true" /> <span className="hidden sm:inline">Sign out</span>
              </Link>
            )}
          </div>
        </header>
        {children}
      </main>
      </div>
      {aside}
    </>
  );
}
