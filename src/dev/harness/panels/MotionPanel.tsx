import { useState } from 'react';
import Button from '../../../components/Button';
import Countdown from '../../../components/Countdown';
import FailurePage from '../../../components/FailurePage';
import Skeleton, { Busy, RowsSkeleton } from '../../../components/Skeleton';
import { Ticker } from '../../../components/motion';
import { TIMING, forMotionPreference, transitionFor, type NavType } from '../../../guest/transitions/variants';
import type { PanelProps } from '../MockLab';
import { Case, Grid, LabButton } from '../parts';

/* The lab itself adds no motion (R20); these are the site's own components, each with a replay or toggle. */

const ROUTES: { from: string; to: string; nav: NavType; first?: boolean }[] = [
  { from: '/', to: '/events', nav: 'PUSH', first: true },
  { from: '/events', to: '/events/some-event', nav: 'PUSH' },
  { from: '/events', to: '/races/2026-r16-malaysia', nav: 'PUSH' },
  { from: '/', to: '/play', nav: 'PUSH' },
  { from: '/events', to: '/', nav: 'POP' },
  { from: '/events', to: '/profile', nav: 'REPLACE' },
  { from: '/events', to: '/host', nav: 'PUSH' },
];

export default function MotionPanel({ nowMs }: PanelProps) {
  const [run, setRun] = useState(0);
  const [reduce, setReduce] = useState(false);
  const [boom, setBoom] = useState(false);
  return (
    <Grid>
      <Case title="Transitions" note="transitionFor picks the kind per navigation; reduced motion collapses every one to a short fade. Durations are the cover and reveal times in ms." wide>
        <LabButton pressed={reduce} onClick={() => setReduce((v) => !v)}>reduced motion</LabButton>
        <table className="mt-3 w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-line text-left font-mono text-[0.65rem] uppercase tracking-widest text-muted">
              <th className="py-1 pr-2 font-normal">from → to</th><th className="py-1 pr-2 font-normal">nav</th><th className="py-1 pr-2 font-normal">kind</th><th className="py-1 pr-2 font-normal">cover</th><th className="py-1 font-normal">reveal</th>
            </tr>
          </thead>
          <tbody>
            {ROUTES.map((r) => {
              const t = transitionFor(r.from, r.to, r.nav, !!r.first);
              const m = t ? forMotionPreference(t, reduce) : null;
              return (
                <tr key={r.from + r.to + r.nav} className="border-b border-line/60">
                  <td className="py-1 pr-2 font-mono text-ink">{r.from} → {r.to}</td>
                  <td className="py-1 pr-2 text-muted">{r.nav}{r.first ? ' (first visit)' : ''}</td>
                  <td className="py-1 pr-2 text-ink">{m ? m.kind : 'none (instant)'}</td>
                  <td className="py-1 pr-2 font-mono text-muted">{m ? TIMING[m.kind].coverMs : '-'}</td>
                  <td className="py-1 font-mono text-muted">{m ? TIMING[m.kind].revealMs : '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Case>
      <Case title="Countdown and ticker" note="Countdown to race start from the lab clock offset (real ticking); Ticker counts up on mount, Replay remounts it.">
        <p className="text-2xl text-ink"><Countdown target={nowMs + 26 * 3_600_000 + 5_000} /></p>
        <p className="mt-1 text-xs text-muted">Past target: <Countdown target={nowMs - 1000} /> · null: <Countdown target={null} /></p>
        <p className="mt-3 text-2xl text-ink"><Ticker key={run} value={12345} group /> pts · <Ticker key={`f${run}`} value={1.234} format="fixed" decimals={3} /></p>
        <div className="mt-2"><LabButton onClick={() => setRun((n) => n + 1)}>Replay</LabButton></div>
      </Case>
      <Case title="Skeletons" note="Pulse, shimmer, rows, and the Busy wrapper (announces loading to assistive tech).">
        <Busy>
          <div className="space-y-3">
            <Skeleton className="h-6 w-48" />
            <Skeleton variant="shimmer" className="h-6 w-64" />
            <RowsSkeleton rows={3} />
          </div>
        </Busy>
      </Case>
      <Case title="Buttons" note="Every variant, and disabled.">
        <div className="flex flex-wrap gap-3">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button disabled>Disabled</Button>
        </div>
      </Case>
      <Case title="Failure page" note="The red-flag screen the ErrorBoundary shows. Router-free, so it renders here even if routing is broken." wide>
        <LabButton pressed={boom} onClick={() => setBoom((v) => !v)}>{boom ? 'hide' : 'show'} failure page</LabButton>
        {boom && (
          <div className="mt-3 max-h-[28rem] overflow-auto rounded-md border border-line">
            <FailurePage error={new Error('Lab: forced failure')} onRetry={() => setBoom(false)} />
          </div>
        )}
      </Case>
    </Grid>
  );
}
