import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { House, TicketIcon, User } from '@phosphor-icons/react';
import { motion, useReducedMotion } from 'framer-motion';
import { ActiveKerb } from '../components/motion';
import { SPRING } from '../lib/motion';
import { useAuth } from '../lib/auth';
import { isInAppBrowser } from '../lib/inAppBrowser';
import { activeTab, chromeVisible, type TabId } from './mobileChrome';
import { useSignInToProfile } from './parts';

const tabCls =
  'group relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[0.6875rem] leading-none transition-colors focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-accent';

function Tab({
  id,
  current,
  label,
  icon,
}: {
  id: TabId;
  current: TabId | null;
  label: string;
  icon: ReactNode;
}) {
  const on = current === id;
  const reduce = useReducedMotion();
  return (
    <>
      {/* Kerb indicator slides between tabs (shared layout, transform only). */}
      {on && <ActiveKerb layoutId="mobile-tab-kerb" className="inset-x-0 top-0 mx-auto h-[3px] w-9" />}
      <motion.span
        className={`flex ${on ? 'text-ink' : 'text-muted'}`}
        animate={reduce ? undefined : { y: on ? -1 : 0, scale: on ? 1.06 : 1 }}
        transition={SPRING.snappy}
      >
        <span className="flex transition-transform duration-100 group-active:scale-90 motion-reduce:group-active:scale-100">{icon}</span>
      </motion.span>
      <span className={on ? 'font-semibold text-ink' : 'font-medium text-muted'}>{label}</span>
    </>
  );
}

const ICON = { size: 24, weight: 'regular' } as const;

export default function MobileNav() {
  const { pathname } = useLocation();
  if (!chromeVisible(pathname)) return null;
  return <ChromeInner pathname={pathname} />;
}

function ChromeInner({ pathname }: { pathname: string }) {
  const { ready, user } = useAuth();
  const signIn = useSignInToProfile();
  const current = activeTab(pathname);
  const message = signIn.err;

  return (
    <>
      {message && (
        <p
          role="status"
          className="fixed inset-x-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 rounded-lg border border-line bg-raised px-4 py-3 text-center text-sm text-ink md:hidden"
        >
          {message}
        </p>
      )}
      <nav
        aria-label="Primary"
        data-testid="mobile-tabbar"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-base pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <div className="mx-auto flex h-16 max-w-md items-stretch">
          <Link to="/" aria-current={current === 'home' ? 'page' : undefined} className={tabCls}>
            <Tab id="home" current={current} label="Home" icon={<House {...ICON} aria-hidden="true" />} />
          </Link>
          <Link to="/events" aria-current={current === 'events' ? 'page' : undefined} className={tabCls}>
            <Tab id="events" current={current} label="Events" icon={<TicketIcon {...ICON} aria-hidden="true" />} />
          </Link>
          {user || !ready || isInAppBrowser() ? (
            <Link to="/profile" aria-current={current === 'profile' ? 'page' : undefined} className={tabCls}>
              <Tab id="profile" current={current} label="Profile" icon={<User {...ICON} aria-hidden="true" />} />
            </Link>
          ) : (
            <button type="button" disabled={signIn.busy} className={tabCls} onClick={() => void signIn.start()}>
              <Tab
                id="profile"
                current={current}
                label={signIn.busy ? 'Signing in' : 'Sign in'}
                icon={<User {...ICON} aria-hidden="true" />}
              />
            </button>
          )}
        </div>
      </nav>
    </>
  );
}
