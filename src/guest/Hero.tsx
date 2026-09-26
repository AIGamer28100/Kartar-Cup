import { motion, useReducedMotion } from 'framer-motion';
import Countdown from '../components/Countdown';
import StatusDot from '../components/StatusDot';
import { getRace } from '../config/calendar';
import type { EventConfig } from '../lib/types';
import { istReadout } from './model';
import { CloseTimer, Eyebrow, Reveal } from './parts';

/** Decorative track outline. The accent stroke draws itself (stroke only; static under reduced motion). */
function TrackLine() {
  const reduce = useReducedMotion();
  const d =
    'M14 92 C14 60 40 52 62 58 C86 64 96 40 122 34 C152 27 176 44 172 70 C168 92 190 104 214 94 C240 84 244 52 226 36 C212 24 196 14 176 14';
  return (
    <svg viewBox="0 0 260 120" className="h-auto w-full" fill="none" aria-hidden="true" focusable="false">
      <path d={d} stroke="var(--color-raised)" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
      <motion.path
        d={d}
        stroke="var(--color-accent)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={reduce ? false : { pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: reduce ? 0 : 2.4, ease: 'easeInOut', delay: 0.3 }}
      />
    </svg>
  );
}

function Readout({ config }: { config: EventConfig }) {
  const race = getRace(config.raceId);
  const t = istReadout(config.raceStartUtc.toMillis());
  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-widest text-muted">
        {race ? `Round ${String(race.round).padStart(2, '0')}` : 'Race weekend'}
        {config.circuit ? ` / ${config.circuit}` : ''}
      </p>
      <p className="mt-2 font-mono text-7xl font-medium leading-[0.9] tabular-nums tracking-tighter">
        {t.day}
        <span className="text-muted"> {t.month}</span>
      </p>
      <p className="mt-3 font-mono text-sm uppercase tracking-widest text-muted">
        Lights out <span className="text-ink tabular-nums">{t.time}</span> IST
      </p>
    </div>
  );
}

/** Landing hero for the scheduled and open states (before the guest is in the quiz). */
export default function Hero({ config, status }: { config: EventConfig; status: 'scheduled' | 'open' }) {
  const scheduled = status === 'scheduled';
  return (
    <>
      <Reveal>
        <div className="flex items-center gap-2">
          <StatusDot status={scheduled ? 'locked' : 'open'} />
          <Eyebrow>{config.subtitle}</Eyebrow>
        </div>
        <h1 className="mt-6 text-5xl font-semibold leading-[0.95] tracking-tighter">{config.name}</h1>
        <p className="mt-4 max-w-[30ch] text-lg text-muted">
          {scheduled
            ? 'Picks open at lights-out. Get your name on the grid now and radio your calls the second the lights go.'
            : 'Picks are open. Radio your calls in before the pit lane closes.'}
        </p>
      </Reveal>
      <Reveal index={1} className="mt-8">
        {scheduled ? (
          <>
            <p className="text-sm text-muted">Picks open in</p>
            <Countdown target={config.opensAt.toMillis()} className="block text-5xl font-medium" />
          </>
        ) : (
          <CloseTimer closesAt={config.closesAt.toMillis()} />
        )}
      </Reveal>
      <Reveal index={2} className="mt-10">
        <Readout config={config} />
      </Reveal>
      <div className="mt-6 flex flex-1 items-center">
        <TrackLine />
      </div>
    </>
  );
}
