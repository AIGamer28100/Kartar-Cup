import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useLocation, useNavigationType, type Location } from 'react-router';
import { TransitionOverlay } from './graphics';
import {
  forMotionPreference,
  routeMeta,
  SWAP_AT,
  transitionFor,
  type RouteMeta,
  type TransitionKind,
} from './variants';

/*
 * R40: themed page transitions for the PUBLIC routes (declarative <Routes>, no data router).
 * The rendered location lags the real one until the overlay fully covers the page, then swaps, so
 * the new page mounts exactly once (no double render) and is never seen half-built. Swap, end and
 * cleanup are driven by setTimeout, never by animation callbacks, so navigation always completes
 * even if the tab is hidden or the animation fails. Host / excluded routes swap synchronously.
 */

const LIGHTS_KEY = 'kc-lights-out-seen';
let lightsSeenFallback = false;

function peekFirstVisit(): boolean {
  try {
    return sessionStorage.getItem(LIGHTS_KEY) === null && !lightsSeenFallback;
  } catch {
    return !lightsSeenFallback;
  }
}
function markLightsSeen() {
  lightsSeenFallback = true;
  try {
    sessionStorage.setItem(LIGHTS_KEY, '1');
  } catch {
    /* storage unavailable: the in-memory flag still limits it to once per page load */
  }
}

/** Move focus to the new page's main heading (it may still be lazy-loading, so retry briefly). */
function focusHeading(tries = 12) {
  const h = document.querySelector<HTMLElement>('main h1, h1');
  if (h) {
    if (!h.hasAttribute('tabindex')) h.setAttribute('tabindex', '-1');
    h.focus({ preventScroll: true });
    return;
  }
  if (tries > 0) window.setTimeout(() => focusHeading(tries - 1), 100);
}

interface Run {
  id: number;
  kind: TransitionKind;
  durationMs: number;
  meta: RouteMeta;
}

/** Entrance wrapper: opacity + small rise, spring. Mounted fresh (keyed) after each transition. */
export function PageEnter({ animate, children }: { animate: boolean; children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={animate ? (reduce ? { opacity: 0 } : { opacity: 0, y: 16 }) : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 26 }}
    >
      {children}
    </motion.div>
  );
}

export default function TransitionLayer({ children }: { children: (location: Location) => ReactNode }) {
  const location = useLocation();
  const navType = useNavigationType();
  const reduce = useReducedMotion() ?? false;
  const reduceRef = useRef(reduce);
  reduceRef.current = reduce;
  const [displayed, setDisplayed] = useState<Location>(location);
  const [run, setRun] = useState<Run | null>(null);
  const [enterId, setEnterId] = useState(0);
  const [announce, setAnnounce] = useState('');
  const prev = useRef<Location>(location);
  const scrollByKey = useRef(new Map<string, number>());
  const seq = useRef(0);

  useLayoutEffect(() => {
    const prevScroll = 'scrollRestoration' in history ? history.scrollRestoration : null;
    if (prevScroll) history.scrollRestoration = 'manual';
    return () => {
      if (prevScroll) history.scrollRestoration = prevScroll;
    };
  }, []);

  useLayoutEffect(() => {
    const from = prev.current;
    if (!location || !from || from === location) return;
    scrollByKey.current.set(from.key, window.scrollY);
    prev.current = location;

    const toPath = location.pathname + location.search + location.hash;
    const base = transitionFor(from.pathname + from.search + from.hash, toPath, navType, peekFirstVisit());
    const meta = routeMeta(location.pathname);
    if (!base || !meta) {
      setRun(null);
      setDisplayed(location);
      return;
    }
    if (base.kind === 'lights-out') markLightsSeen();

    const restoreY = navType === 'POP' ? (scrollByKey.current.get(location.key) ?? 0) : 0;
    const settle = () => {
      window.scrollTo({ top: restoreY, left: 0, behavior: 'instant' });
      setAnnounce(`${meta.title} page`);
    };

    // Hidden tab: animations would not run, so swap straight away.
    if (document.hidden) {
      setRun(null);
      setDisplayed(location);
      setEnterId(++seq.current);
      settle();
      const t = window.setTimeout(() => focusHeading(), 50);
      return () => window.clearTimeout(t);
    }

    const t = forMotionPreference(base, reduceRef.current);
    const runId = ++seq.current;
    const enterId = ++seq.current;
    setRun({ id: runId, kind: t.kind, durationMs: t.durationMs, meta });
    const swap = window.setTimeout(() => {
      setDisplayed(location);
      setEnterId(enterId);
      settle();
    }, t.durationMs * SWAP_AT[t.kind]);
    const end = window.setTimeout(() => {
      setRun(null);
      window.scrollTo({ top: restoreY, left: 0, behavior: 'instant' });
      focusHeading();
    }, t.durationMs);
    return () => {
      // A newer navigation superseded this one: finish it instantly rather than stalling.
      window.clearTimeout(swap);
      window.clearTimeout(end);
    };
    // navType changes together with location; reduce is read through a ref so a preference flip
    // mid-run cannot cancel the pending swap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  return (
    <>
      <PageEnter key={enterId} animate={enterId > 0}>
        {children(displayed)}
      </PageEnter>
      {run && <TransitionOverlay key={run.id} kind={run.kind} durationMs={run.durationMs} meta={run.meta} />}
      <div role="status" aria-live="polite" className="sr-only">
        {announce}
      </div>
    </>
  );
}
