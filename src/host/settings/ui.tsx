import type { ReactNode } from 'react';
import { fmtIst, fmtLocal, fmtUtc } from './time';

export const inputCls =
  'min-h-11 w-full rounded-lg border border-line bg-raised px-3 text-[1rem] text-ink placeholder:text-muted transition duration-150 hover:border-muted disabled:opacity-50 aria-[invalid=true]:border-accent';

export const iconBtn =
  'inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-line bg-raised text-ink transition duration-150 hover:border-muted active:translate-y-px active:scale-[0.96] disabled:pointer-events-none disabled:opacity-40';

export const linkBtn =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line bg-raised px-4 text-[1rem] font-medium text-ink transition duration-150 hover:border-muted active:translate-y-px active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50';

export function Field({
  id,
  label,
  error,
  hint,
  children,
  className = '',
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-muted">
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1.5 text-sm text-muted">{hint}</p>}
      {error && (
        <p id={`${id}-err`} role="alert" className="mt-1.5 text-sm text-accent">
          {error}
        </p>
      )}
    </div>
  );
}

export function Section({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <section aria-label={title} className="border-b border-line py-8">
      <h2 className="text-xl font-semibold md:text-2xl">{title}</h2>
      {intro && <p className="mt-1 max-w-2xl text-muted">{intro}</p>}
      <div className="mt-6">{children}</div>
    </section>
  );
}

/** One instant shown in host-local, IST and UTC. */
export function TimeTriple({ label, ms, testId }: { label: string; ms: number; testId?: string }) {
  const ok = Number.isFinite(ms);
  return (
    <div data-testid={testId}>
      <p className="text-sm font-medium text-muted">{label}</p>
      <dl className="mt-1 grid grid-cols-[3.5rem_1fr] gap-x-3 gap-y-0.5 font-mono text-sm">
        <dt className="text-muted">Local</dt>
        <dd>{ok ? fmtLocal(ms) : '--'}</dd>
        <dt className="text-muted">IST</dt>
        <dd>{ok ? fmtIst(ms) : '--'}</dd>
        <dt className="text-muted">UTC</dt>
        <dd>{ok ? fmtUtc(ms) : '--'}</dd>
      </dl>
    </div>
  );
}
