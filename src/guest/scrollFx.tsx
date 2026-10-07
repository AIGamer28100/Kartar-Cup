import { useEffect, useState } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
} from "framer-motion";

/**
 * True only on desktop-ish viewports (>= breakpointPx) with no reduced-motion preference.
 * Scroll-linked parallax/sticky effects are gated behind this — narrow/touch viewports keep
 * their native scroll physics untouched (R29), and prefers-reduced-motion always wins.
 */
export function useDesktopMotion(breakpointPx = 768): boolean {
  const reduce = useReducedMotion();
  const [desktop, setDesktop] = useState(
    () => typeof window !== "undefined" && window.innerWidth >= breakpointPx,
  );
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${breakpointPx}px)`);
    const onChange = () => setDesktop(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [breakpointPx]);
  return desktop && !reduce;
}

/**
 * Page-wide "timing tower" scroll indicator: a thin sector-ticked line (echoing the hero
 * TrackMap's draw-in motif) whose red fill grows from the left edge as the guest scrolls the
 * whole page. Pure decoration (aria-hidden), driven by useScroll — never a window
 * scroll listener. Fully skipped under prefers-reduced-motion rather than degraded, since a
 * self-drawing line is itself the kind of motion that preference opts out of.
 */
export function ScrollProgressPath() {
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll();

  if (reduce) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-40 h-[3px]"
      aria-hidden="true"
    >
      <svg
        width="100%"
        height="3"
        viewBox="0 0 1000 3"
        preserveAspectRatio="none"
        className="block"
      >
        <line
          x1="0"
          y1="1.5"
          x2="1000"
          y2="1.5"
          className="stroke-line"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
        {Array.from({ length: 9 }).map((_, i) => (
          <line
            key={i}
            x1={(i + 1) * 100}
            y1="0"
            x2={(i + 1) * 100}
            y2="3"
            className="stroke-line"
            strokeWidth={0.6}
            opacity={0.6}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      {/* Progress: a bar scaled from the left edge by scroll position (0 at the top, full at the bottom).
          A dash-offset line cannot be used here: with non-scaling strokes the dash is measured in screen px,
          which made the line start mid-way and wrap around. */}
      <motion.div
        className="absolute inset-0 origin-left bg-accent"
        style={{ scaleX: scrollYProgress }}
      />
    </div>
  );
}
