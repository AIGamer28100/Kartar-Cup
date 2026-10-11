import type { ReactNode } from 'react';
import { Shell, Split } from '../guest/parts';
import { StartLightsLoader } from './motion';

/** Placeholder block. Default `pulse` (opacity pulse; what the host console uses, unchanged);
 * public pages may pass `shimmer` for a transform-only light sweep. Both are static under
 * prefers-reduced-motion. */
export default function Skeleton({ className = '', variant = 'pulse' }: { className?: string; variant?: 'pulse' | 'shimmer' }) {
  return (
    <div
      aria-hidden="true"
      className={`rounded-lg bg-raised ${variant === 'shimmer' ? 'shimmer' : 'motion-safe:animate-pulse'} ${className}`}
    />
  );
}

/** Wraps skeleton content: announces busy state to assistive tech with a visually hidden label. */
export function Busy({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div aria-busy="true" role="status" className={className}>
      <span className="sr-only">Loading</span>
      {children}
    </div>
  );
}

/** Guest-layout skeleton: eyebrow, headline, copy, and a right-hand action block (matches Split). */
export function PageSkeleton() {
  return (
    <Shell bare>
      <Busy className="flex flex-1 flex-col">
        <Split
          left={
            <div className="flex flex-col gap-4">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="mt-2 h-14 w-full max-w-md" />
              <Skeleton className="h-14 w-3/4 max-w-sm" />
              <Skeleton className="mt-2 h-6 w-full max-w-[34ch]" />
              <Skeleton className="mt-6 h-16 w-56" />
            </div>
          }
          right={
            <div className="flex flex-col gap-4">
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          }
        />
      </Busy>
    </Shell>
  );
}

/** Public-route loading state (Suspense fallback while a page's code downloads): the start-light
 * loader plus a shimmering outline of a typical public page, so the layout does not jump. */
export function RouteSkeleton() {
  return (
    <Shell bare>
      <div className="flex flex-1 flex-col" aria-busy="true">
        <StartLightsLoader label="Loading page" />
        <div className="mt-8 flex flex-col gap-4" aria-hidden="true">
          <Skeleton variant="shimmer" className="h-3 w-32" />
          <Skeleton variant="shimmer" className="h-12 w-full max-w-md" />
          <Skeleton variant="shimmer" className="h-5 w-full max-w-[38ch]" />
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Skeleton variant="shimmer" className="h-40" />
            <Skeleton variant="shimmer" className="h-40" />
          </div>
        </div>
      </div>
    </Shell>
  );
}

/** Host-layout skeleton: stacked rows under the header. */
export function RowsSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <Busy className="mt-8 space-y-4">
      <Skeleton className="h-32" />
      {Array.from({ length: rows - 1 }, (_, i) => (
        <Skeleton key={i} className="h-16" />
      ))}
    </Busy>
  );
}
