import type { CSSProperties, ReactNode } from 'react';
import { motion, type Variants } from 'framer-motion';
import type { Bezier } from '../../lib/motion';
import type { Dir, RouteMeta, TransitionKind } from './variants';

/*
 * R40 route-transition artwork. Everything here is our own vector drawing (R25-R27: no real team
 * cars, logos or livery). Only transform / opacity animate, and the layer exists only while a
 * transition runs. Two phases: `cover` (the overlay arrives and fully covers the old page; the new
 * route swaps in underneath) and `reveal` (it clears off the new page).
 */

export type Phase = 'cover' | 'reveal';

/** Arrive: quick launch, braking into the cover position. */
const EASE_COVER: Bezier = [0.45, 0, 0.2, 1];
/** Leave: accelerate away. */
const EASE_REVEAL: Bezier = [0.6, 0, 0.8, 0.25];

const GPU: CSSProperties = { willChange: 'transform' };
const GPU_FADE: CSSProperties = { willChange: 'opacity' };

/** Original go-kart silhouette, facing right (viewBox 120x50). */
export function KartRacer({ className = '', light = false }: { className?: string; light?: boolean }) {
  return (
    <svg viewBox="0 0 120 50" className={className} aria-hidden="true" focusable="false">
      <g className={light ? 'fill-ink' : 'fill-base'}>
        <path d="M12 31 L38 25 L86 25 L108 30 L110 34 L12 36 Z" />
        <rect x="98" y="27" width="16" height="5" rx="2.5" />
        <rect x="6" y="12" width="3.5" height="18" rx="1" />
        <rect x="2" y="10" width="14" height="3.5" rx="1.5" />
        <path d="M46 26 L50 18 L66 18 L70 26 Z" />
        <circle cx="57" cy="13.5" r="7" />
        <path d="M74 25 L82 18 L84 19.5 L77 27 Z" />
        <circle cx="28" cy="37" r="11" />
        <circle cx="92" cy="38" r="8.5" />
      </g>
      <g className={light ? 'fill-base' : 'fill-ink'}>
        <circle cx="28" cy="37" r="4" />
        <circle cx="92" cy="38" r="3" />
        <rect x="50" y="10" width="14" height="3" rx="1.5" opacity="0.85" />
      </g>
    </svg>
  );
}

/** Motion-blur streaks: thin ink lines fading toward the tail. Static drawing (it moves with its
 * parent), positioned by the caller. `flip` points the tails the other way. */
export function SpeedLines({ className = '', flip = false }: { className?: string; flip?: boolean }) {
  const rows = [
    { top: '8%', w: '70%', o: 0.55 },
    { top: '22%', w: '95%', o: 0.35 },
    { top: '37%', w: '55%', o: 0.7 },
    { top: '52%', w: '85%', o: 0.4 },
    { top: '66%', w: '60%', o: 0.6 },
    { top: '81%', w: '100%', o: 0.3 },
    { top: '93%', w: '45%', o: 0.5 },
  ];
  return (
    <div className={`pointer-events-none ${className}`} aria-hidden="true">
      {rows.map((r, i) => (
        <span
          key={i}
          className="absolute h-[2px] rounded-full"
          style={{
            top: r.top,
            width: r.w,
            [flip ? 'left' : 'right']: 0,
            opacity: r.o,
            backgroundImage: `linear-gradient(${flip ? 270 : 90}deg, transparent, var(--color-ink))`,
          }}
        />
      ))}
    </div>
  );
}

const kerbV: CSSProperties = {
  backgroundImage: 'repeating-linear-gradient(180deg, var(--color-accent) 0 26px, var(--color-ink) 26px 52px)',
};
const kerbH: CSSProperties = {
  backgroundImage: 'repeating-linear-gradient(90deg, var(--color-accent) 0 26px, var(--color-ink) 26px 52px)',
};
/** Flag squares from the dedicated chequer tokens. */
const chequer = (size: number): CSSProperties => ({
  backgroundColor: 'var(--color-chequer-light)',
  backgroundImage: `repeating-conic-gradient(var(--color-chequer-dark) 0 25%, transparent 0 50%)`,
  backgroundSize: `${size * 2}px ${size * 2}px`,
});
/** Faint diagonal tarmac grain inside panels. */
const grain: CSSProperties = {
  backgroundImage:
    'repeating-linear-gradient(115deg, transparent 0 22px, rgb(255 255 255 / 0.025) 22px 23px), radial-gradient(120% 80% at 50% 50%, var(--color-raised), var(--color-base) 70%)',
};

/** Pit-board style destination chip (sector + label), shown while the page is covered. */
function PitBoard({ meta, phase, prefix }: { meta: RouteMeta; phase: Phase; prefix?: string }) {
  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center"
      style={GPU_FADE}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={phase === 'cover' ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 1.02 }}
      transition={phase === 'cover' ? { duration: 0.12, delay: 0.1, ease: 'easeOut' } : { duration: 0.09, ease: 'easeIn' }}
    >
      <div className="flex items-stretch overflow-hidden rounded-md border border-line font-mono tabular-nums shadow-[0_12px_40px_rgb(0_0_0/0.45)]">
        <span className="flex items-center bg-accent px-3 py-2 text-base font-semibold text-accent-ink md:px-4 md:text-xl">
          {meta.sector}
        </span>
        <span className="flex items-center bg-raised px-4 py-2 text-base font-semibold tracking-[0.14em] text-ink md:px-6 md:text-xl">
          {prefix ? <span className="mr-2 text-muted">{prefix}</span> : null}
          {meta.label}
        </span>
      </div>
    </motion.div>
  );
}

function sweepVariants(dir: Dir, coverS: number, revealS: number, axis: 'x' | 'y' = 'x'): Variants {
  const off = dir > 0 ? '-100%' : '100%';
  const away = dir > 0 ? '100%' : '-100%';
  const at = (v: string) => (axis === 'x' ? { x: v } : { y: v });
  return {
    off: at(off),
    cover: { ...at('0%'), transition: { duration: coverS, ease: EASE_COVER } },
    reveal: { ...at(away), transition: { duration: revealS, ease: EASE_REVEAL } },
  };
}

/** Horizontal sweep: a skewed navy panel with a kerb (or chequered) leading edge, speed streaks and
 * a kart riding the edge. A 12deg skew shifts each corner by tan(12deg) * h / 2 (about 0.11h), so the
 * panel overhangs the viewport by 12vh on each side: its corners never expose the page, and almost
 * all of its travel is visible (no dead time off-screen). */
function Sweep({
  meta,
  phase,
  dir,
  coverMs,
  revealMs,
  startCovered,
  flag,
}: {
  meta: RouteMeta;
  phase: Phase;
  dir: Dir;
  coverMs: number;
  revealMs: number;
  startCovered: boolean;
  flag: boolean;
}) {
  const lead = dir > 0 ? 'right-0' : 'left-0';
  const trail = dir > 0 ? 'left-0' : 'right-0';
  return (
    <>
      <motion.div
        className="absolute inset-y-0 -left-[12vh] w-[calc(100vw+24vh)]"
        style={GPU}
        variants={sweepVariants(dir, coverMs / 1000, revealMs / 1000)}
        initial={startCovered ? 'cover' : 'off'}
        animate={phase}
      >
        <div className="absolute inset-0 -skew-x-[12deg] overflow-hidden" style={grain}>
          {/* leading edge: kerb or chequered flag, with a red glow line */}
          {flag ? (
            <div className={`absolute inset-y-0 ${lead} w-12 md:w-16`} style={chequer(16)} />
          ) : (
            <div className={`absolute inset-y-0 ${lead} w-4 md:w-5`} style={kerbV} />
          )}
          <div
            className={`absolute inset-y-0 ${dir > 0 ? (flag ? 'right-12 md:right-16' : 'right-4 md:right-5') : flag ? 'left-12 md:left-16' : 'left-4 md:left-5'} w-[3px] bg-accent shadow-[0_0_24px_6px_rgb(216_30_54/0.5)]`}
          />
          {/* trailing edge: slim kerb */}
          <div className={`absolute inset-y-0 ${trail} w-2`} style={kerbV} />
        </div>
        {/* motion-blur streaks and the kart ride just behind the leading edge (unskewed) */}
        <div className={`absolute top-[14%] bottom-[14%] ${dir > 0 ? 'right-[4.5rem]' : 'left-[4.5rem]'} w-[46vw]`}>
          <SpeedLines className="absolute inset-0" flip={dir < 0} />
        </div>
        <div className={`absolute top-[62%] ${dir > 0 ? 'right-[5rem] md:right-[6.5rem]' : 'left-[5rem] -scale-x-100 md:left-[6.5rem]'}`}>
          <KartRacer light className="h-10 w-24 md:h-14 md:w-32" />
        </div>
      </motion.div>
      <PitBoard meta={meta} phase={phase} prefix={flag ? 'LAP' : undefined} />
    </>
  );
}

/** Pit lane: a board drops in from the top with a kerb bottom edge and a pit-lane limit line. */
function PitLane({ meta, phase, coverMs, revealMs, startCovered }: { meta: RouteMeta; phase: Phase; coverMs: number; revealMs: number; startCovered: boolean }) {
  return (
    <>
      <motion.div
        className="absolute inset-x-0 -top-[10vh] h-[120vh]"
        style={GPU}
        variants={sweepVariants(1, coverMs / 1000, revealMs / 1000, 'y')}
        initial={startCovered ? 'cover' : 'off'}
        animate={phase}
      >
        <div className="absolute inset-0" style={grain} />
        <div className="absolute inset-x-0 bottom-0 h-4" style={kerbH} />
        <div className="absolute inset-x-0 bottom-4 h-[3px] bg-accent shadow-[0_0_24px_6px_rgb(216_30_54/0.45)]" />
        {/* pit-lane speed-limit line: dashed white */}
        <div
          className="absolute inset-x-0 top-[34%] h-1 opacity-50"
          style={{ backgroundImage: 'repeating-linear-gradient(90deg, var(--color-ink) 0 40px, transparent 40px 80px)' }}
        />
        <div className="absolute inset-x-0 top-0 h-2" style={kerbH} />
      </motion.div>
      <PitBoard meta={meta} phase={phase} prefix="PIT" />
    </>
  );
}

/** Five red lights fill left to right while the page covers; at reveal they all go out at once. */
function LightsOut({ phase, coverMs, revealMs, startCovered }: { phase: Phase; coverMs: number; revealMs: number; startCovered: boolean }) {
  const c = coverMs / 1000;
  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center bg-base"
      style={GPU_FADE}
      initial={{ opacity: startCovered ? 1 : 0 }}
      animate={{ opacity: phase === 'cover' ? 1 : 0 }}
      transition={phase === 'cover' ? { duration: c * 0.45, ease: 'easeOut' } : { duration: revealMs / 1000, ease: 'easeIn', delay: 0.04 }}
    >
      <div className="flex items-center gap-3 rounded-2xl border border-line bg-raised px-5 py-4 sm:gap-4 sm:px-7">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="relative size-9 rounded-full bg-base shadow-[inset_0_0_0_1px_var(--color-line)] sm:size-12">
            <motion.div
              className="absolute inset-0 rounded-full bg-accent shadow-[0_0_26px_6px_rgb(216_30_54/0.55)]"
              style={GPU_FADE}
              initial={{ opacity: startCovered ? 1 : 0 }}
              animate={{ opacity: phase === 'cover' ? 1 : 0 }}
              transition={phase === 'cover' ? { duration: 0.02, delay: c * 0.15 + i * c * 0.15 } : { duration: 0 }}
            />
          </div>
        ))}
      </div>
    </motion.div>
  );
}

/** Quiet cover fade (back/forward, replace, reduced motion). Opacity only. */
function Fade({ phase, coverMs, revealMs, startCovered }: { phase: Phase; coverMs: number; revealMs: number; startCovered: boolean }) {
  return (
    <motion.div
      className="absolute inset-0 bg-base"
      style={GPU_FADE}
      initial={{ opacity: startCovered ? 1 : 0 }}
      animate={{ opacity: phase === 'cover' ? 1 : 0 }}
      transition={{ duration: (phase === 'cover' ? coverMs : revealMs) / 1000, ease: 'linear' }}
    />
  );
}

export function TransitionOverlay({
  kind,
  phase,
  dir,
  coverMs,
  revealMs,
  startCovered,
  meta,
}: {
  kind: TransitionKind;
  phase: Phase;
  dir: Dir;
  coverMs: number;
  revealMs: number;
  startCovered: boolean;
  meta: RouteMeta;
}) {
  const common = { phase, coverMs, revealMs, startCovered };
  let body: ReactNode;
  switch (kind) {
    case 'kerb-sweep':
      body = <Sweep meta={meta} dir={dir} flag={false} {...common} />;
      break;
    case 'chequered':
      body = <Sweep meta={meta} dir={dir} flag {...common} />;
      break;
    case 'pit-lane':
      body = <PitLane meta={meta} {...common} />;
      break;
    case 'lights-out':
      body = <LightsOut {...common} />;
      break;
    default:
      body = <Fade {...common} />;
  }
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[100] overflow-hidden"
      data-testid="route-transition"
      data-kind={kind}
      data-phase={phase}
    >
      {body}
    </div>
  );
}
