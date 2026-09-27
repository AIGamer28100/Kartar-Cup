import type { ReactNode } from 'react';
import { Shell, Split } from '../guest/parts';

/** Shimmer block: opacity pulse only, disabled under prefers-reduced-motion. */
export default function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`rounded-lg bg-raised motion-safe:animate-pulse ${className}`} />
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
