import { motion, useReducedMotion } from 'framer-motion';
import Countdown from '../components/Countdown';
import StatusDot from '../components/StatusDot';
import { getRace } from '../config/calendar';
import type { EventConfig } from '../lib/types';
import { istReadout } from './model';
import type { ReactNode } from 'react';
import { CloseTimer, Eyebrow, H1, Reveal, Split } from './parts';

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
      <p className="mt-2 font-mono text-7xl font-medium leading-[0.9] md:text-[clamp(4rem,8vw,7.5rem)] tabular-nums tracking-tighter">
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
export default function Hero({
  config,
  status,
  children,
}: {
  config: EventConfig;
  status: 'scheduled' | 'open';
  children?: ReactNode;
}) {
  const scheduled = status === 'scheduled';
  return (
    <Split
      left={
    <>
      <Reveal>
        <div className="flex items-center gap-2">
          <StatusDot status={scheduled ? 'locked' : 'open'} />
          <Eyebrow>{config.subtitle}</Eyebrow>
        </div>
        <h1 className={`mt-6 ${H1}`}>{config.name}</h1>
        <p className="mt-4 max-w-[34ch] text-lg text-muted md:text-xl">
          {scheduled
            ? 'Picks open at lights-out. Get your name on the grid now and radio your calls the second the lights go.'
            : 'Picks are open. Radio your calls in before the pit lane closes.'}
        </p>
      </Reveal>
      <Reveal index={1} className="mt-8">
        {scheduled ? (
          <>
            <p className="text-sm text-muted">Picks open in</p>
            <Countdown target={config.opensAt.toMillis()} className="block text-5xl font-medium md:text-[clamp(3rem,5vw,4.5rem)]" />
          </>
        ) : (
          <CloseTimer closesAt={config.closesAt.toMillis()} />
        )}
      </Reveal>
      <Reveal index={2} className="mt-10">
        <Readout config={config} />
      </Reveal>
      <div className="mt-8 flex flex-1 items-center md:hidden">
        <TrackLine />
      </div>
    </>
      }
      right={
        <>
          <div className="mb-10 hidden md:block">
            <TrackLine />
          </div>
          {children}
        </>
      }
    />
  );
}
