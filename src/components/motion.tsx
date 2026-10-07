import {
  Children,
  Fragment,
  useEffect,
  useRef,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import {
  animate,
  AnimatePresence,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useSpring,
  type Variants,
} from 'framer-motion';
import { DUR, EASE, formatLapTime, formatTicker, magneticOffset, SPRING, STAGGER, staggerDelay } from '../lib/motion';

/*
 * Reusable motion primitives for the public site. All of them:
 * - animate transform / opacity only,
 * - render their final state immediately under prefers-reduced-motion (no movement),
 * - never hold per-frame React state (motion values / refs only).
 * Tokens come from src/lib/motion.ts.
 */

type RevealKind = 'rise' | 'drs' | 'slide' | 'fade' | 'scale';

const HIDDEN: Record<RevealKind, Record<string, number | string>> = {
  rise: { opacity: 0, y: 18 },
  // DRS flap: the block hinges open from its top edge.
  drs: { opacity: 0, rotateX: -62, y: 6, transformPerspective: 900 },
  slide: { opacity: 0, x: -22 },
  fade: { opacity: 0 },
  scale: { opacity: 0, scale: 0.94 },
};
const SHOWN = { opacity: 1, x: 0, y: 0, rotateX: 0, scale: 1 };

type Tag = 'div' | 'li' | 'section' | 'article' | 'span' | 'p' | 'figure' | 'ol' | 'ul' | 'dl';

const TAGS = {
  div: motion.div,
  li: motion.li,
  section: motion.section,
  article: motion.article,
  span: motion.span,
  p: motion.p,
  figure: motion.figure,
  ol: motion.ol,
  ul: motion.ul,
  dl: motion.dl,
} as const;

/**
 * Reveal on scroll: plays once when the element first enters the viewport (immediately for content
 * already on screen). `index` staggers siblings; `kind` picks the entrance.
 */
export function InView({
  children,
  as = 'div',
  kind = 'rise',
  index = 0,
  delay = 0,
  className,
  style,
  amount = 0.15,
  id,
}: {
  children?: ReactNode;
  as?: Tag;
  kind?: RevealKind;
  index?: number;
  delay?: number;
  className?: string;
  style?: CSSProperties;
  amount?: number;
  id?: string;
}) {
  const reduce = useReducedMotion();
  const Comp = TAGS[as];
  const isDrs = kind === 'drs';
  return (
    <Comp
      id={id}
      className={className}
      style={isDrs ? { transformOrigin: '50% 0%', ...style } : style}
      initial={reduce ? false : HIDDEN[kind]}
      whileInView={SHOWN}
      viewport={{ once: true, amount, margin: '0px 0px -6% 0px' }}
      transition={
        reduce
          ? { duration: 0 }
          : isDrs
            ? { duration: DUR.slow, ease: EASE.drs, delay: delay + staggerDelay(index) }
            : { ...SPRING.soft, delay: delay + staggerDelay(index) }
      }
    >
      {children}
    </Comp>
  );
}

const listVariants = (step: number): Variants => ({
  hidden: {},
  shown: { transition: { staggerChildren: step, delayChildren: 0.04 } },
});
const itemVariants: Record<RevealKind, Variants> = Object.fromEntries(
  (Object.keys(HIDDEN) as RevealKind[]).map((k) => [
    k,
    {
      hidden: HIDDEN[k],
      shown: { ...SHOWN, transition: k === 'drs' ? { duration: DUR.slow, ease: EASE.drs } : SPRING.soft },
    },
  ]),
) as unknown as Record<RevealKind, Variants>;

/** Staggered list container: children wrapped in <StaggerItem> enter one after another in view. */
export function Stagger({
  children,
  as = 'div',
  step = STAGGER.base,
  className,
  amount = 0.1,
  'aria-label': ariaLabel,
}: {
  children: ReactNode;
  as?: Tag;
  step?: number;
  className?: string;
  amount?: number;
  'aria-label'?: string;
}) {
  const reduce = useReducedMotion();
  const Comp = TAGS[as];
  // Long lists: cap the total stagger so the last item never waits long.
  const count = Children.count(children);
  const capped = count > 1 ? Math.min(step, 0.42 / (count - 1)) : step;
  return (
    <Comp
      className={className}
      aria-label={ariaLabel}
      variants={listVariants(capped)}
      initial={reduce ? false : 'hidden'}
      whileInView="shown"
      viewport={{ once: true, amount, margin: '0px 0px -6% 0px' }}
    >
      {children}
    </Comp>
  );
}

export function StaggerItem({
  children,
  as = 'div',
  kind = 'rise',
  className,
  style,
}: {
  children?: ReactNode;
  as?: Tag;
  kind?: RevealKind;
  className?: string;
  style?: CSSProperties;
}) {
  const Comp = TAGS[as];
  return (
    <Comp className={className} style={kind === 'drs' ? { transformOrigin: '50% 0%', ...style } : style} variants={itemVariants[kind]}>
      {children}
    </Comp>
  );
}

type TickerFormat = 'int' | 'fixed' | 'lap';

const formatValue = (v: number, format: TickerFormat, decimals: number, group: boolean) =>
  format === 'lap' ? formatLapTime(v, decimals) : formatTicker(v, format === 'int' ? 0 : decimals, group);

/**
 * Count-up / lap-time ticker. Counts from `from` to `value` the first time it scrolls into view,
 * writing the text through a ref (no React state per frame). Screen readers get the final value
 * only (the moving digits are aria-hidden).
 */
export function Ticker({
  value,
  from = 0,
  format = 'int',
  decimals = 3,
  group = false,
  duration = DUR.ticker,
  className = '',
  suffix,
}: {
  value: number;
  from?: number;
  format?: TickerFormat;
  decimals?: number;
  group?: boolean;
  duration?: number;
  className?: string;
  suffix?: ReactNode;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '0px 0px -30px 0px' });
  const reduce = useReducedMotion();
  const finalText = formatValue(value, format, decimals, group);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduce || !inView) {
      el.textContent = reduce ? finalText : formatValue(from, format, decimals, group);
      return;
    }
    const controls = animate(from, value, {
      duration,
      ease: EASE.launch,
      onUpdate: (v) => {
        el.textContent = formatValue(v, format, decimals, group);
      },
      onComplete: () => {
        el.textContent = finalText;
      },
    });
    return () => controls.stop();
  }, [inView, reduce, value, from, format, decimals, group, duration, finalText]);

  return (
    <span className={`tabular-nums ${className}`}>
      <span ref={ref} aria-hidden="true">
        {reduce ? finalText : formatValue(from, format, decimals, group)}
      </span>
      <span className="sr-only">{finalText}</span>
      {suffix}
    </span>
  );
}

/**
 * Timing-screen digit roll: each character sits in its own slot; when it changes the old glyph
 * slides up and out while the new one rolls in. Use for values that change about once a second
 * (countdowns), not per frame.
 */
export function DigitRoll({ text, className = '' }: { text: string; className?: string }) {
  const reduce = useReducedMotion();
  // Non-breaking spaces so a space slot keeps its width inside the inline-block cells.
  const chars = text.replace(/ /g, ' ').split('');
  return (
    <span className={`inline-flex tabular-nums ${className}`} aria-hidden="true">
      {chars.map((c, i) => (
        <span key={`${chars.length - i}`} className="relative inline-block overflow-hidden" style={{ lineHeight: 'inherit' }}>
          {/* invisible sizer keeps the slot width stable */}
          <span className="invisible">{/\d/.test(c) ? '0' : c}</span>
          <AnimatePresence initial={false}>
            <motion.span
              key={c}
              className="absolute inset-0 text-center"
              initial={reduce ? false : { y: '-100%', opacity: 0 }}
              animate={{ y: '0%', opacity: 1 }}
              exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { y: '100%', opacity: 0 }}
              transition={reduce ? { duration: 0 } : { duration: DUR.base, ease: EASE.out }}
            >
              {c}
            </motion.span>
          </AnimatePresence>
        </span>
      ))}
    </span>
  );
}

/**
 * Magnetic hover: the child leans a few px toward a fine pointer and springs back on leave. No effect
 * for touch or reduced motion. Wrap buttons / CTAs; the wrapper is an inline-block span.
 */
export function Magnetic({ children, strength = 6, className = '' }: { children: ReactNode; strength?: number; className?: string }) {
  const reduce = useReducedMotion();
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const x = useSpring(mx, SPRING.magnet);
  const y = useSpring(my, SPRING.magnet);
  const onMove = (e: ReactPointerEvent<HTMLSpanElement>) => {
    if (reduce || e.pointerType !== 'mouse') return;
    const r = e.currentTarget.getBoundingClientRect();
    const o = magneticOffset(e.clientX - r.left, e.clientY - r.top, r.width, r.height, strength);
    mx.set(o.x);
    my.set(o.y);
  };
  const reset = () => {
    mx.set(0);
    my.set(0);
  };
  return (
    <motion.span className={`inline-block ${className}`} style={reduce ? undefined : { x, y }} onPointerMove={onMove} onPointerLeave={reset}>
      {children}
    </motion.span>
  );
}

/**
 * Shared-layout active indicator (kerb strip). Render it inside the active item only; framer
 * animates it between items with a snappy spring (transform). Reduced motion: jumps.
 */
export function ActiveKerb({ layoutId, className = '' }: { layoutId: string; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.span
      aria-hidden="true"
      layoutId={layoutId}
      className={`pointer-events-none absolute ${className}`}
      style={{ backgroundImage: 'var(--kerb-stripes)', borderRadius: 2 }}
      transition={reduce ? { duration: 0 } : SPRING.snappy}
    />
  );
}

/** Sliding pill behind the active option of a segmented control. */
export function ActivePill({ layoutId, className = '' }: { layoutId: string; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.span
      aria-hidden="true"
      layoutId={layoutId}
      className={`pointer-events-none absolute inset-0 -z-10 rounded-md bg-raised shadow-[inset_0_-2px_0_var(--color-accent)] ${className}`}
      transition={reduce ? { duration: 0 } : SPRING.snappy}
    />
  );
}

/**
 * Skeleton-to-content crossfade without layout jank: both layers share one grid cell, so the box
 * never collapses between them; the skeleton fades out as the content fades (and lifts) in.
 */
export function SkeletonSwap({
  loading,
  skeleton,
  children,
  className = '',
}: {
  loading: boolean;
  skeleton: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const t = reduce ? { duration: 0 } : { duration: DUR.base, ease: EASE.out };
  return (
    <div className={`grid ${className}`}>
      <AnimatePresence initial={false}>
        {loading ? (
          <motion.div key="skeleton" className="[grid-area:1/1] min-w-0" initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={t}>
            {skeleton}
          </motion.div>
        ) : (
          <motion.div
            key="content"
            className="[grid-area:1/1] min-w-0"
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={t}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Headline reveal: each word rises out of its own clipping slot, staggered, like a grid lining up.
 * Text stays real text (selectable, read once by screen readers). Reduced motion: static.
 */
export function SplitWords({ text, delay = 0, step = STAGGER.base }: { text: string; delay?: number; step?: number }) {
  const reduce = useReducedMotion();
  const words = text.split(' ');
  return (
    <>
      {words.map((w, i) => (
        <Fragment key={`${w}-${i}`}>
          <span className="inline-block overflow-hidden pb-[0.08em] align-bottom">
            <motion.span
              className="inline-block"
              initial={reduce ? false : { y: '105%' }}
              animate={{ y: '0%' }}
              transition={reduce ? { duration: 0 } : { duration: DUR.slow + 0.16, ease: EASE.out, delay: delay + i * step }}
            >
              {w}
            </motion.span>
          </span>
          {i < words.length - 1 ? ' ' : null}
        </Fragment>
      ))}
    </>
  );
}

/** A red/white kerb strip that draws itself (scaleX) when it scrolls into view. Decorative. */
export function KerbDraw({ className = '', delay = 0, origin = 'left' }: { className?: string; delay?: number; origin?: 'left' | 'right' }) {
  const reduce = useReducedMotion();
  return (
    <motion.span
      aria-hidden="true"
      className={`block rounded-[2px] ${className}`}
      style={{ backgroundImage: 'var(--kerb-stripes)', transformOrigin: origin === 'left' ? '0% 50%' : '100% 50%' }}
      initial={reduce ? false : { scaleX: 0 }}
      whileInView={{ scaleX: 1 }}
      viewport={{ once: true }}
      transition={reduce ? { duration: 0 } : { duration: DUR.slow + 0.2, ease: EASE.launch, delay }}
    />
  );
}

/** Five start lights filling in sequence: the loading indicator for public routes. */
export function StartLightsLoader({ label = 'Loading', className = '' }: { label?: string; className?: string }) {
  return (
    <span role="status" className={`inline-flex items-center gap-3 ${className}`}>
      <span className="start-lights" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
        <span />
      </span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
