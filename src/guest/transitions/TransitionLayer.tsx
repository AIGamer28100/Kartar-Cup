import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useLocation, useNavigationType, type Location } from 'react-router';
import { preloadRoute } from '../../routes';
import { DUR, EASE } from '../../lib/motion';
import { TransitionOverlay, type Phase } from './graphics';
import {
  forMotionPreference,
  isPublicPath,
  MAX_HOLD_MS,
  routeMeta,
  transitionFor,
  type Dir,
  type RouteMeta,
  type TransitionKind,
} from './variants';

/*
 * R40: themed page transitions for the PUBLIC routes (declarative <Routes>, no data router).
 *
 * Order of events for one navigation:
 *   1. cover: the overlay sweeps in over the old page while the new route's code preloads;
 *   2. swap: once covered AND the code is ready (or after MAX_HOLD_MS), the rendered location
 *      switches, scroll is restored, and the new page mounts exactly once, hidden under the overlay;
 *   3. reveal: the overlay clears while the new page glides in (PageEnter).
 * Every step is driven by timers and a promise, never animation callbacks, so navigation always
 * completes (hidden tab, failed animation, slow network). The overlay never takes pointer events.
 * Host / excluded routes swap synchronously. Total time with code ready: < 450ms.
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
  phase: Phase;
  dir: Dir;
  coverMs: number;
  revealMs: number;
  startCovered: boolean;
  meta: RouteMeta;
}

/** Entrance for the freshly swapped page: a short glide in the travel direction plus fade, while
 * the overlay clears. Reduced motion: opacity only. First load: no entrance (sections reveal
 * themselves). */
export function PageEnter({ animate, dir, children }: { animate: boolean; dir: Dir; children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={animate ? (reduce ? { opacity: 0 } : { opacity: 0, x: dir * 28 }) : false}
      animate={{ opacity: 1, x: 0 }}
      transition={reduce ? { duration: DUR.fast } : { duration: DUR.slow, ease: EASE.out }}
    >
      {children}
    </motion.div>
  );
}

/** Warm up a public route's code on link intent (hover, focus, touch), once per path. */
function useIntentPreload() {
  useEffect(() => {
    const seen = new Set<string>();
    const onIntent = (e: Event) => {
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a || a.target === '_blank' || a.origin !== window.location.origin) return;
      const path = a.pathname;
      if (seen.has(path) || !isPublicPath(path)) return;
      seen.add(path);
      void preloadRoute(path);
    };
    const opts = { passive: true, capture: true } as const;
    document.addEventListener('pointerover', onIntent, opts);
    document.addEventListener('focusin', onIntent, opts);
    document.addEventListener('touchstart', onIntent, opts);
    return () => {
      document.removeEventListener('pointerover', onIntent, opts);
      document.removeEventListener('focusin', onIntent, opts);
      document.removeEventListener('touchstart', onIntent, opts);
    };
  }, []);
}

export default function TransitionLayer({ children }: { children: (location: Location) => ReactNode }) {
  const location = useLocation();
  const navType = useNavigationType();
  const reduce = useReducedMotion() ?? false;
  const reduceRef = useRef(reduce);
  reduceRef.current = reduce;
  const [displayed, setDisplayed] = useState<Location>(location);
  const [run, setRun] = useState<Run | null>(null);
  const runRef = useRef<Run | null>(null);
  runRef.current = run;
  const [enter, setEnter] = useState<{ id: number; dir: Dir }>({ id: 0, dir: 1 });
  const [announce, setAnnounce] = useState('');
  const prev = useRef<Location>(location);
  const scrollByKey = useRef(new Map<string, number>());
  const seq = useRef(0);

  useIntentPreload();

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
    const ready = preloadRoute(location.pathname);

    // Hidden tab: animations would not run, so swap straight away.
    if (document.hidden) {
      setRun(null);
      setDisplayed(location);
      setEnter({ id: ++seq.current, dir: base.dir });
      settle();
      const t = window.setTimeout(() => focusHeading(), 50);
      return () => window.clearTimeout(t);
    }

    const t = forMotionPreference(base, reduceRef.current);
    const runId = ++seq.current;
    // A previous transition still covering the screen: continue from covered instead of
    // uncovering and re-covering (no flash on rapid clicks).
    const startCovered = runRef.current?.phase === 'cover';
    setRun({ id: runId, kind: t.kind, phase: 'cover', dir: t.dir, coverMs: t.coverMs, revealMs: t.revealMs, startCovered, meta });

    let cancelled = false;
    let covered = false;
    let loaded = false;
    let swapped = false;
    const timers: number[] = [];
    const swap = () => {
      if (cancelled || swapped) return;
      swapped = true;
      setDisplayed(location);
      setEnter({ id: ++seq.current, dir: t.dir });
      settle();
      setRun((r) => (r && r.id === runId ? { ...r, phase: 'reveal' } : r));
      timers.push(
        window.setTimeout(() => {
          setRun((r) => (r && r.id === runId ? null : r));
          window.scrollTo({ top: restoreY, left: 0, behavior: 'instant' });
          focusHeading();
        }, t.revealMs),
      );
    };
    timers.push(
      window.setTimeout(
        () => {
          covered = true;
          if (loaded) swap();
          else timers.push(window.setTimeout(swap, MAX_HOLD_MS));
        },
        startCovered ? 0 : t.coverMs,
      ),
    );
    void ready.then(() => {
      loaded = true;
      if (covered) swap();
    });
    return () => {
      // A newer navigation superseded this one; it takes over from here.
      cancelled = true;
      timers.forEach((id) => window.clearTimeout(id));
    };
    // navType changes together with location; reduce is read through a ref so a preference flip
    // mid-run cannot cancel the pending swap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  return (
    <>
      <PageEnter key={enter.id} animate={enter.id > 0} dir={enter.dir}>
        {children(displayed)}
      </PageEnter>
      {run && (
        <TransitionOverlay
          key={run.id}
          kind={run.kind}
          phase={run.phase}
          dir={run.dir}
          coverMs={run.coverMs}
          revealMs={run.revealMs}
          startCovered={run.startCovered}
          meta={run.meta}
        />
      )}
      <div role="status" aria-live="polite" className="sr-only">
        {announce}
      </div>
    </>
  );
}
