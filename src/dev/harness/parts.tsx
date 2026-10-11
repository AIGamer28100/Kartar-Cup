/** Shared chrome for Mock Lab panels. Internal tool: plain, dense, no motion of its own (R20). */
import { useState, type ReactNode } from 'react';

/** One labelled block of a panel. `note` says what the block is for and what to look at. */
export function Case({ title, note, children, wide = false }: { title: string; note?: string; children: ReactNode; wide?: boolean }) {
  return (
    <section className={`rounded-md border border-line bg-raised/40 p-4 ${wide ? 'lg:col-span-2' : ''}`}>
      <h2 className="font-mono text-[0.7rem] uppercase tracking-widest text-muted">{title}</h2>
      {note && <p className="mt-1 max-w-[70ch] text-xs text-muted">{note}</p>}
      <div className="mt-3 min-w-0">{children}</div>
    </section>
  );
}

/** Panels are grids of Cases. */
export function Grid({ children }: { children: ReactNode }) {
  return <div className="grid min-w-0 gap-4 lg:grid-cols-2">{children}</div>;
}

const chip = 'min-h-8 rounded-full border px-3 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

/** A small single-choice switch, for picking which variant a Case shows. */
export function Pick<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button key={o.id} type="button" aria-pressed={o.id === value} onClick={() => onChange(o.id)} className={`${chip} ${o.id === value ? 'border-ink bg-ink text-base' : 'border-line text-muted hover:border-muted hover:text-ink'}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function LabButton({ children, onClick, pressed }: { children: ReactNode; onClick: () => void; pressed?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={pressed} className={`${chip} ${pressed ? 'border-ink bg-ink text-base' : 'border-line text-muted hover:border-muted hover:text-ink'}`}>
      {children}
    </button>
  );
}

/** Collapsible raw value, so a panel can show both the rendered UI and the data behind it. */
export function Json({ label, value }: { label: string; value: unknown }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="font-mono text-[0.65rem] uppercase tracking-widest text-muted underline decoration-dotted">
        {open ? 'hide' : 'show'} {label}
      </button>
      {open && (
        <pre className="mt-1 max-h-64 overflow-auto rounded border border-line bg-base p-2 font-mono text-[0.65rem] text-muted">{JSON.stringify(value, null, 1)}</pre>
      )}
    </div>
  );
}

/** States a panel must show for a data-driven component: ok / loading / empty / error. */
export const DATA_STATES = [
  { id: 'ok' as const, label: 'Loaded' },
  { id: 'loading' as const, label: 'Loading' },
  { id: 'empty' as const, label: 'Empty' },
  { id: 'error' as const, label: 'Error' },
];
export type DataState = (typeof DATA_STATES)[number]['id'];
