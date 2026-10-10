/**
 * Mock Lab - the dev-only harness at /race-state-mock.
 *
 * One page where every feature of the site can be exercised with NO Firebase, NO live F1 session and
 * NO network: src/dev/mockNet.ts replays real captured API payloads, src/dev/fixtures feeds the
 * components typed mock documents. Never reachable from a production build (see App.tsx).
 *
 * Internal tool, so R20 applies: quiet, dense, small type, no motion of its own.
 */
import { Suspense, lazy, useCallback, useEffect, useMemo, useState, type ComponentType } from 'react';
import { useSearchParams } from 'react-router';
import ErrorBoundary from '../../components/ErrorBoundary';
import { clearMemoryCache } from '../../lib/raceData';
import { clearNetCaches, getMockNetState, installMockNet, setScenario, uninstallMockNet, type Scenario } from '../mockNet';

export interface PanelProps {
  /** "Now" as the lab sees it: real time plus the offset chosen in the toolbar. */
  nowMs: number;
}

interface Tab {
  id: string;
  label: string;
  hint: string;
  load: () => Promise<{ default: ComponentType<PanelProps> }>;
}

/** Tab order is the order of the site's own story: what a guest sees, then what a host runs. */
const TABS: Tab[] = [
  { id: 'race-states', label: 'Race states', hint: 'Every RaceState, start lights, flags, backdrop, track map, podium', load: () => import('./panels/RaceStatesPanel') },
  { id: 'openf1', label: 'Mock OpenF1', hint: 'Every F1 data call against the replayed payloads, including the failure paths', load: () => import('./panels/OpenF1Panel') },
  { id: 'quiz', label: 'Quiz', hint: 'All five steps, review, submit, edit, banner states, gate and scoring', load: () => import('./panels/QuizPanel') },
  { id: 'booking', label: 'Booking', hint: 'Tiers, quantities, discounts, sold out, closed, cancelled, mock pay', load: () => import('./panels/BookingPanel') },
  { id: 'ticket', label: 'Ticket', hint: 'QR payload and every booking status, refunds, own cards', load: () => import('./panels/TicketPanel') },
  { id: 'cards', label: 'Cards', hint: 'VIP and play cards, random draw, pass numbers, score bonus', load: () => import('./panels/CardsPanel') },
  { id: 'results', label: 'Results', hint: 'Results hub: driver and team tables, fastest lap, loading and error states', load: () => import('./panels/ResultsPanel') },
  { id: 'previous-card', label: 'Previous card', hint: 'The Previous race card on Events: podium layouts, loading and no-data states', load: () => import('./panels/PreviousCardPanel') },
  { id: 'cup', label: 'Cup', hint: 'Championship standings, seasons, rounds, results', load: () => import('./panels/CupPanel') },
  { id: 'screen', label: 'Big screen', hint: 'Lobby, standings and the staged podium reveal', load: () => import('./panels/ScreenPanel') },
  { id: 'host', label: 'Host console', hint: 'Leaderboard, crowd reveal, results form, roster, check-in, venue search', load: () => import('./panels/HostPanel') },
  { id: 'overlay', label: 'Live overlay', hint: 'The host PiP overlay over the race: QR, countdown, laps, players in, top 5, at both size presets', load: () => import('./panels/OverlayPanel') },
  { id: 'profile', label: 'Profile', hint: 'Achievements, own history, own bookings, card bonus', load: () => import('./panels/ProfilePanel') },
  { id: 'motion', label: 'Motion & chrome', hint: 'Transitions, countdown, skeletons, buttons, failure pages', load: () => import('./panels/MotionPanel') },
  { id: 'coverage', label: 'Coverage', hint: 'What this lab covers and what it does not', load: () => import('./panels/CoveragePanel') },
];

const SCENARIOS: { id: Scenario; label: string }[] = [
  { id: 'completed', label: 'Completed race (Malaysia)' },
  { id: 'upcoming', label: 'Upcoming race (Singapore)' },
  { id: 'no-data', label: 'No data yet' },
  { id: 'rate-limited', label: 'Rate limited (429)' },
  { id: 'offline', label: 'Offline' },
];

const OFFSETS: { label: string; ms: number }[] = [
  { label: '-7d', ms: -7 * 24 * 3600_000 },
  { label: '-3h', ms: -3 * 3600_000 },
  { label: '-30m', ms: -30 * 60_000 },
  { label: 'now', ms: 0 },
  { label: '+30m', ms: 30 * 60_000 },
  { label: '+3h', ms: 3 * 3600_000 },
  { label: '+7d', ms: 7 * 24 * 3600_000 },
];

const TAB_KEY = 'kc:lab:tab';
const panels = new Map<string, ComponentType<PanelProps>>();
const lazyPanel = (tab: Tab) => {
  let c = panels.get(tab.id);
  if (!c) {
    c = lazy(tab.load);
    panels.set(tab.id, c);
  }
  return c;
};

const chip = 'min-h-8 rounded-full border px-3 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';
const on = 'border-ink bg-ink text-base';
const off = 'border-line text-muted hover:border-muted hover:text-ink';

export default function MockLab() {
  const [params, setParams] = useSearchParams();
  const fromUrl = params.get('tab');
  const stored = (() => {
    try {
      return localStorage.getItem(TAB_KEY);
    } catch {
      return null;
    }
  })();
  const initial = TABS.find((t) => t.id === fromUrl) ?? TABS.find((t) => t.id === stored) ?? TABS[0];
  const [tabId, setTabId] = useState(initial.id);
  const [offsetMs, setOffsetMs] = useState(0);
  const [scenario, setScenarioState] = useState<Scenario>('completed');
  const [installed, setInstalled] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [logTick, setLogTick] = useState(0);

  const tab = TABS.find((t) => t.id === tabId) ?? TABS[0];

  const selectTab = useCallback(
    (id: string) => {
      setTabId(id);
      const next = new URLSearchParams(params);
      next.set('tab', id);
      setParams(next, { replace: true });
      try {
        localStorage.setItem(TAB_KEY, id);
      } catch {
        /* storage blocked: the URL still carries the tab */
      }
    },
    [params, setParams],
  );

  // Keep the URL honest on first paint, so a reload or a shared link lands on the same panel.
  useEffect(() => {
    if (fromUrl !== tabId) selectTab(tabId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- first paint only
  }, []);

  // Mock Net is global (it patches fetch), so it must come back off when the lab unmounts.
  useEffect(() => () => uninstallMockNet(), []);

  useEffect(() => {
    if (!showLog) return;
    const t = setInterval(() => setLogTick((n) => n + 1), 700);
    return () => clearInterval(t);
  }, [showLog]);

  /** raceData keeps its own module-level Map, which mockNet cannot reach: clear both together. */
  const clearAll = useCallback(() => {
    clearNetCaches();
    clearMemoryCache();
  }, []);

  const toggleNet = () => {
    if (installed) {
      uninstallMockNet();
      setInstalled(false);
    } else {
      installMockNet(scenario);
      setInstalled(true);
    }
    clearAll();
  };

  const pickScenario = (s: Scenario) => {
    setScenarioState(s);
    if (installed) setScenario(s);
    clearAll();
  };

  // getMockNetState() is a snapshot with no subscription, so re-read it whenever anything that could
  // have changed it ticks.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the deps are the triggers, not the inputs
  const state = useMemo(() => getMockNetState(), [installed, scenario, logTick]);
  const nowMs = Date.now() + offsetMs;
  const Panel = lazyPanel(tab);

  return (
    <div className="min-h-[100dvh] bg-base text-ink">
      <header className="sticky top-0 z-40 border-b border-line bg-base/95 backdrop-blur">
        <div className="mx-auto w-full max-w-[100rem] px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <p className="font-mono text-[0.65rem] uppercase tracking-widest text-muted">Mock Lab · dev only</p>

            <div className="flex items-center gap-2">
              <button type="button" onClick={toggleNet} className={`${chip} ${installed ? on : off}`} aria-pressed={installed}>
                Mock net {installed ? 'on' : 'off'}
              </button>
              <label className="sr-only" htmlFor="lab-scenario">
                Scenario
              </label>
              <select
                id="lab-scenario"
                value={scenario}
                onChange={(e) => pickScenario(e.target.value as Scenario)}
                className="min-h-8 rounded-md border border-line bg-raised px-2 text-xs text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                {SCENARIOS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
              <button type="button" onClick={clearAll} className={`${chip} ${off}`}>
                Clear caches
              </button>
              <button type="button" onClick={() => setShowLog((v) => !v)} className={`${chip} ${showLog ? on : off}`} aria-expanded={showLog}>
                Calls {state.calls.length}
              </button>
            </div>

            <div role="group" aria-label="Clock offset" className="flex items-center gap-1">
              {OFFSETS.map((o) => (
                <button key={o.label} type="button" aria-pressed={offsetMs === o.ms} onClick={() => setOffsetMs(o.ms)} className={`${chip} ${offsetMs === o.ms ? on : off}`}>
                  {o.label}
                </button>
              ))}
              <span className="ml-1 font-mono text-[0.65rem] text-muted">{new Date(nowMs).toISOString().slice(0, 16).replace('T', ' ')}Z</span>
            </div>
          </div>

          {showLog && (
            <div className="mt-3 max-h-48 overflow-auto rounded-md border border-line bg-raised p-2">
              {state.calls.length === 0 ? (
                <p className="font-mono text-[0.65rem] text-muted">No intercepted calls yet.</p>
              ) : (
                <ol className="grid list-none gap-0.5 p-0 font-mono text-[0.65rem]">
                  {[...state.calls].reverse().map((c, i) => (
                    <li key={`${c.at}-${i}`} className="flex gap-2 truncate">
                      <span className={c.status === 'reject' || Number(c.status) >= 400 ? 'text-accent-text' : 'text-muted'}>{String(c.status)}</span>
                      <span className="text-muted">{c.served}</span>
                      <span className="truncate text-ink">{c.url}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}

          <nav aria-label="Mock Lab panels" className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {TABS.map((t) => (
              <button key={t.id} type="button" aria-current={t.id === tabId ? 'page' : undefined} onClick={() => selectTab(t.id)} className={`${chip} shrink-0 ${t.id === tabId ? on : off}`}>
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[100rem] px-4 py-6">
        <p className="mb-5 max-w-[80ch] text-sm text-muted">{tab.hint}</p>
        {/* Keyed so switching panels remounts cleanly and one panel's crash cannot strand another. */}
        <ErrorBoundary key={tab.id}>
          <Suspense fallback={<p className="font-mono text-xs text-muted">Loading {tab.label}...</p>}>
            <Panel nowMs={nowMs} />
          </Suspense>
        </ErrorBoundary>
      </main>
    </div>
  );
}
