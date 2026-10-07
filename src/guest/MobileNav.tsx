import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { FlagCheckered, House, TicketIcon, User } from '@phosphor-icons/react';
import { motion, useReducedMotion } from 'framer-motion';
import { ActiveKerb } from '../components/motion';
import { SPRING } from '../lib/motion';
import { useAuth } from '../lib/auth';
import { watchActiveEventId, watchEventConfig } from '../lib/db';
import { useEventStatus } from '../lib/eventStatus';
import { isInAppBrowser } from '../lib/inAppBrowser';
import type { EventConfig } from '../lib/types';
import { activeTab, chromeVisible, predictEnabled, predictHint, stripCopy, type TabId } from './mobileChrome';
import { useSignInToProfile } from './parts';

/** Router location state used to open the quiz view on the home page (see HomePage). */
export const OPEN_QUIZ_STATE = { quiz: true } as const;

/** One shared listener pair for the whole public site's persistent chrome (strip + Predict gate).
 * Mounted only on public paths, so host/screen pages never subscribe. */
function useActiveEvent(): EventConfig | null | undefined {
  const [eventId, setEventId] = useState<string | null | undefined>(undefined);
  const [event, setEvent] = useState<EventConfig | null | undefined>(undefined);
  useEffect(() => watchActiveEventId(setEventId, () => setEvent(null)), []);
  useEffect(() => {
    if (eventId === undefined) return;
    if (eventId === null) {
      setEvent(null);
      return;
    }
    return watchEventConfig(eventId, setEvent, () => setEvent(null));
  }, [eventId]);
  return event;
}

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
  const navigate = useNavigate();
  const event = useActiveEvent();
  const status = useEventStatus(event);
  const signIn = useSignInToProfile();
  const [note, setNote] = useState('');
  const timer = useRef<number>(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => setNote(''), [pathname]);

  const say = (msg: string) => {
    setNote(msg);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setNote(''), 3500);
  };

  const current = activeTab(pathname);
  const canPredict = predictEnabled(status);
  const strip = event ? stripCopy(status, event.closesAt.toMillis(), Date.now()) : null;
  const message = note || signIn.err;

  return (
    <>
      {strip && (
        <div
          role="status"
          aria-label={strip.sr}
          data-testid="race-strip"
          data-kind={strip.kind}
          className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-40 flex h-9 items-center justify-center gap-2 border-t border-line bg-raised px-4 font-mono text-xs uppercase tracking-widest text-muted md:bottom-4 md:left-1/2 md:right-auto md:w-auto md:-translate-x-1/2 md:rounded-full md:border"
        >
          <span
            aria-hidden="true"
            className={`size-2 shrink-0 rounded-full ${strip.kind === 'open' ? 'bg-accent motion-safe:animate-[breathe_2.4s_ease-in-out_infinite]' : 'bg-muted'}`}
          />
          <span aria-hidden="true">{strip.label}</span>
          {strip.time && (
            <span aria-hidden="true" className="tabular-nums text-ink">
              {strip.time}
            </span>
          )}
        </div>
      )}
      {message && (
        <p
          role="status"
          className="fixed inset-x-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 rounded-lg border border-line bg-raised px-4 py-3 text-center text-sm text-ink md:hidden"
          style={strip ? { bottom: 'calc(6.75rem + env(safe-area-inset-bottom))' } : undefined}
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
          <button
            type="button"
            aria-disabled={!canPredict}
            aria-describedby={canPredict ? undefined : 'predict-hint'}
            className={`${tabCls} ${canPredict ? '' : 'opacity-60'}`}
            onClick={() => (canPredict ? navigate('/', { state: OPEN_QUIZ_STATE }) : say(predictHint(status)))}
          >
            <Tab
              id="predict"
              current={current}
              label="Predict"
              icon={
                <span className="relative">
                  <FlagCheckered {...ICON} aria-hidden="true" />
                  {canPredict && (
                    <span
                      aria-hidden="true"
                      className="absolute -right-1 -top-0.5 size-2 rounded-full bg-accent motion-safe:animate-[breathe_2.4s_ease-in-out_infinite]"
                    />
                  )}
                </span>
              }
            />
            {!canPredict && (
              <span id="predict-hint" className="sr-only">
                {predictHint(status)}
              </span>
            )}
          </button>
          {user || !ready || isInAppBrowser() ? (
            <Link to="/profile" aria-current={current === 'profile' ? 'page' : undefined} className={tabCls}>
              <Tab id="profile" current={current} label="Profile" icon={<User {...ICON} aria-hidden="true" />} />
            </Link>
          ) : (
            <button type="button" disabled={signIn.busy} className={tabCls} onClick={() => void signIn.start()}>
              <Tab
                id="profile"
                current={current}
                label={signIn.busy ? 'Signing in' : 'Profile'}
                icon={<User {...ICON} aria-hidden="true" />}
              />
            </button>
          )}
        </div>
      </nav>
    </>
  );
}
