import type { ReactNode } from 'react';
import Countdown from '../components/Countdown';
import StatusDot from '../components/StatusDot';
import { getRace } from '../config/calendar';
import type { EventConfig } from '../lib/types';
import { istReadout } from './model';
import { Eyebrow, Reveal, Split } from './parts';
import { GameFacts, HowItPlays } from './quiz/Facts';
import { closesCopy, delayedHold, lapLine, opensCopy } from './quiz/logic';
import { LampRow } from './quiz/StartLights';

function Readout({ config }: { config: EventConfig }) {
  const race = getRace(config.raceId);
  const t = istReadout(config.raceStartUtc.toMillis());
  return (
    <p className="font-mono text-xs uppercase tracking-widest text-muted">
      {race ? `Round ${String(race.round).padStart(2, '0')}` : 'Race weekend'}
      {config.circuit ? ` / ${config.circuit}` : ''} / {t.day} {t.month} / Lights out <span className="tabular-nums text-ink">{t.time}</span> IST
    </p>
  );
}

/**
 * Game lobby for /play: the race, the clock (picks open in / close in), the game card (calls, points,
 * close) and the action slot (`children`: sign-in, or the waiting notice once signed in).
 */
export default function Hero({
  config,
  status,
  title,
  children,
}: {
  config: EventConfig;
  status: 'scheduled' | 'open';
  title?: string;
  children?: ReactNode;
}) {
  const live = config;
  const scheduled = status === 'scheduled';
  const held = !scheduled && delayedHold(live);
  const laps = scheduled || held ? null : lapLine(live);
  return (
    <Split
      left={
        <>
          <Reveal>
            <div className="flex items-center gap-2">
              <StatusDot status={scheduled ? 'locked' : 'open'} />
              <Eyebrow>{config.subtitle || 'Race predictor'}</Eyebrow>
            </div>
            <h1 className="mt-4 text-h2 font-semibold text-balance">{title ?? config.name}</h1>
            <p className="mt-3 max-w-[40ch] text-pretty text-muted md:text-lg">
              {scheduled ? `${opensCopy(config)} Get on the grid now and the first call appears by itself.` : `Picks are open. ${closesCopy(live)}`}
            </p>
          </Reveal>
          <Reveal index={1} className="mt-6">
            {scheduled ? (
              <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
                <LampRow lit={0} />
                <div>
                  <p className="font-mono text-xs uppercase tracking-widest text-muted">Picks open in</p>
                  <Countdown target={config.opensAt.toMillis()} className="block text-stat font-medium tracking-tight" />
                </div>
              </div>
            ) : held ? (
              <p role="status" className="rounded-lg border border-warn/50 bg-warn/10 px-3 py-2 text-ink">
                {closesCopy(live)}
              </p>
            ) : (
              <div>
                <p className="font-mono text-xs uppercase tracking-widest text-muted">Picks close in</p>
                <Countdown target={config.closesAt.toMillis()} className="block text-stat font-medium tracking-tight" />
                {laps && <p className="mt-1 font-mono text-xs uppercase tracking-widest text-muted">{laps}</p>}
              </div>
            )}
          </Reveal>
          <Reveal index={2} className="mt-6">
            <GameFacts config={live} />
            <div className="mt-3">
              <Readout config={config} />
            </div>
          </Reveal>
        </>
      }
      right={
        <>
          <Reveal index={2}>{children}</Reveal>
          <Reveal index={3} className="mt-8 border-t border-line pt-6">
            <p className="mb-3 font-mono text-xs uppercase tracking-widest text-muted">How it plays</p>
            <HowItPlays />
          </Reveal>
        </>
      }
    />
  );
}
