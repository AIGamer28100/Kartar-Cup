import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import type { RouteMeta, TransitionKind } from './variants';

/*
 * R40 route-transition artwork. Everything here is our own vector drawing (R25-R27: no real team
 * cars, logos or livery). Only transform / opacity are animated; elements exist only while a
 * transition runs, so will-change is set on them for exactly that window.
 */

const GPU = { willChange: 'transform' } as const;
const GPU_FADE = { willChange: 'opacity' } as const;

/** Original go-kart silhouette, facing right (viewBox 120x50). */
export function KartRacer({ className = '', light = false }: { className?: string; light?: boolean }) {
  return (
    <svg viewBox="0 0 120 50" className={className} aria-hidden="true" focusable="false">
      <g className={light ? 'fill-ink' : 'fill-base'}>
        {/* chassis + nose */}
        <path d="M12 31 L38 25 L86 25 L108 30 L110 34 L12 36 Z" />
        <rect x="98" y="27" width="16" height="5" rx="2.5" />
        {/* rear wing */}
        <rect x="6" y="12" width="3.5" height="18" rx="1" />
        <rect x="2" y="10" width="14" height="3.5" rx="1.5" />
        {/* driver: shoulders + helmet */}
        <path d="M46 26 L50 18 L66 18 L70 26 Z" />
        <circle cx="57" cy="13.5" r="7" />
        {/* steering column */}
        <path d="M74 25 L82 18 L84 19.5 L77 27 Z" />
        {/* wheels */}
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

/** Short trailing speed lines (the reusable page-header accent, if wanted). Static drawing. */
export function SpeedLines({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 40" className={className} aria-hidden="true" focusable="false">
      <g className="fill-ink">
        <rect x="40" y="6" width="120" height="3" rx="1.5" opacity="0.9" />
        <rect x="0" y="15" width="150" height="3" rx="1.5" opacity="0.6" />
        <rect x="70" y="24" width="90" height="3" rx="1.5" opacity="0.8" />
        <rect x="20" y="33" width="110" height="3" rx="1.5" opacity="0.45" />
      </g>
    </svg>
  );
}

/** Checkered-flag edge strip: two-row checker pattern filling its box. */
function Checker({ id, className = '' }: { id: string; className?: string }) {
  return (
    <svg className={className} aria-hidden="true" focusable="false">
      <defs>
        <pattern id={id} width="32" height="32" patternUnits="userSpaceOnUse">
          <rect width="32" height="32" className="fill-base" />
          <rect width="16" height="16" className="fill-ink" />
          <rect x="16" y="16" width="16" height="16" className="fill-ink" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

/** Sector flash in Geist Mono tabular numerals, like a timing-tower update. */
function SectorFlash({ meta, durationMs, times }: { meta: RouteMeta; durationMs: number; times: number[] }) {
  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center"
      style={GPU_FADE}
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 0, 1, 1, 0] }}
      transition={{ duration: durationMs / 1000, times, ease: 'linear' }}
    >
      <div className="flex items-stretch overflow-hidden rounded-md font-mono tabular-nums shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
        <span className="bg-base px-3 py-2 text-[1.25rem] font-semibold text-ink md:px-4 md:text-[1.75rem]">
          {meta.sector}
        </span>
        <span className="bg-ink px-4 py-2 text-[1.25rem] font-semibold tracking-[0.12em] text-base md:px-6 md:text-[1.75rem]">
          {meta.label}
        </span>
      </div>
    </motion.div>
  );
}

const stripes = {
  backgroundImage: 'repeating-linear-gradient(115deg, transparent 0 34px, rgba(0,0,0,0.16) 34px 70px)',
} as const;

function FlagWipe({ meta, durationMs }: { meta: RouteMeta; durationMs: number }) {
  return (
    <>
      <motion.div
        className="absolute inset-y-0 -left-[15vw] w-[130vw]"
        style={GPU}
        initial={{ x: '-100%' }}
        animate={{ x: ['-100%', '0%', '0%', '100%'] }}
        transition={{
          duration: durationMs / 1000,
          times: [0, 0.45, 0.55, 1],
          ease: ['circOut', 'linear', 'circIn'],
        }}
      >
        <div className="absolute -inset-x-16 inset-y-0 -skew-x-[10deg] bg-accent" style={stripes}>
          <Checker id="kc-chk-lead" className="absolute inset-y-0 right-0 h-full w-10" />
          <Checker id="kc-chk-trail" className="absolute inset-y-0 left-0 h-full w-10" />
        </div>
        {/* kart + speed-line trail ride the leading (right) edge */}
        <div className="absolute right-[4.5rem] top-1/2 flex -translate-y-1/2 items-center">
          <SpeedLines className="mr-[-0.5rem] hidden h-10 w-40 sm:block lg:h-14 lg:w-60" />
          <KartRacer className="h-16 w-36 sm:h-20 sm:w-44 lg:h-28 lg:w-64" />
        </div>
      </motion.div>
      <SectorFlash meta={meta} durationMs={durationMs} times={[0, 0.3, 0.42, 0.62, 0.78]} />
    </>
  );
}

function PitLane({ meta, durationMs }: { meta: RouteMeta; durationMs: number }) {
  const kerb = {
    backgroundImage:
      'repeating-linear-gradient(90deg, var(--color-accent) 0 28px, var(--color-ink) 28px 56px)',
  } as const;
  const dash = {
    backgroundImage: 'repeating-linear-gradient(90deg, var(--color-ink) 0 48px, transparent 48px 96px)',
  } as const;
  return (
    <>
      <motion.div
        className="absolute inset-0 bg-raised"
        style={GPU}
        initial={{ x: '100%' }}
        animate={{ x: ['100%', '0%', '0%', '-100%'] }}
        transition={{
          duration: durationMs / 1000,
          times: [0, 0.45, 0.55, 1],
          ease: ['circOut', 'linear', 'circIn'],
        }}
      >
        <div className="absolute inset-x-0 top-0 h-4" style={kerb} />
        <div className="absolute inset-x-0 bottom-0 h-4" style={kerb} />
        {/* pit-wall edge line and centre lane markings */}
        <div className="absolute inset-x-0 top-[18%] h-[3px] bg-ink opacity-80" />
        <div className="absolute inset-x-0 bottom-[18%] h-[3px] bg-ink opacity-80" />
        <div className="absolute inset-x-0 top-[calc(50%+5.25rem)] h-1.5 opacity-60" style={dash} />
        <div className="absolute left-6 top-[calc(50%+2.25rem)] -scale-x-100 flex items-center md:left-16">
          <SpeedLines className="mr-[-0.5rem] h-8 w-32" />
          <KartRacer light className="h-14 w-32" />
        </div>
        <div className="absolute inset-y-0 left-0 w-8 opacity-90">
          <Checker id="kc-chk-pit" className="h-full w-full" />
        </div>
      </motion.div>
      <SectorFlash
        meta={{ ...meta, label: `PIT / ${meta.label}` }}
        durationMs={durationMs}
        times={[0, 0.3, 0.42, 0.62, 0.78]}
      />
    </>
  );
}

/** Five red lights light left to right, all go out, then the page is revealed. */
function LightsOut({ durationMs }: { durationMs: number }) {
  const d = durationMs / 1000;
  return (
    <>
      <motion.div
        className="absolute inset-0 bg-base"
        style={GPU_FADE}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 1, 0] }}
        transition={{ duration: d, times: [0, 0.1, 0.66, 1], ease: 'linear' }}
      />
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        style={GPU_FADE}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 1, 0] }}
        transition={{ duration: d, times: [0, 0.1, 0.62, 0.7], ease: 'linear' }}
      >
        <div className="flex items-center gap-3 rounded-2xl border border-line bg-raised px-4 py-4 sm:gap-5 sm:px-8 sm:py-6">
          {[0, 1, 2, 3, 4].map((i) => {
            const on = 0.14 + i * 0.08;
            return (
              <div key={i} className="relative h-10 w-10 rounded-full bg-base sm:h-16 sm:w-16">
                <motion.div
                  className="absolute inset-0 rounded-full bg-accent shadow-[0_0_28px_6px_rgba(220,50,60,0.55)]"
                  style={GPU_FADE}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 0, 1, 1, 0] }}
                  transition={{
                    duration: d,
                    times: [0, on, on + 0.02, 0.6, 0.62],
                    ease: 'linear',
                  }}
                />
              </div>
            );
          })}
        </div>
      </motion.div>
    </>
  );
}

/** Quick cover fade used for back/forward (350ms) and reduced motion (150ms). */
function Fade({ durationMs, slide }: { durationMs: number; slide: boolean }) {
  return (
    <motion.div
      className="absolute inset-0 bg-base"
      style={slide ? { willChange: 'transform, opacity' } : GPU_FADE}
      initial={{ opacity: 0 }}
      animate={slide ? { opacity: [0, 1, 0], x: ['-2%', '0%', '2%'] } : { opacity: [0, 1, 0] }}
      transition={{
        duration: durationMs / 1000,
        times: [0, 0.5, 1],
        ease: 'linear',
      }}
    />
  );
}

export function TransitionOverlay({
  kind,
  durationMs,
  meta,
}: {
  kind: TransitionKind;
  durationMs: number;
  meta: RouteMeta;
}) {
  let body: ReactNode;
  switch (kind) {
    case 'flag-wipe':
      body = <FlagWipe meta={meta} durationMs={durationMs} />;
      break;
    case 'pit-lane':
      body = <PitLane meta={meta} durationMs={durationMs} />;
      break;
    case 'lights-out':
      body = <LightsOut durationMs={durationMs} />;
      break;
    case 'crossfade':
      body = <Fade durationMs={durationMs} slide />;
      break;
    default:
      body = <Fade durationMs={durationMs} slide={false} />;
  }
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[100] overflow-hidden"
      data-testid="route-transition"
      data-kind={kind}
    >
      {body}
    </div>
  );
}
