import { useRef, type KeyboardEvent, type ReactNode } from 'react';

export interface TabDef {
  id: string;
  label: string;
}

/** Minimal, fast tablist: arrow keys move + select, Home/End jump to the ends (R20: no springs, no motion budget spent here). */
export function TabList({
  tabs,
  active,
  onChange,
  label,
}: {
  tabs: TabDef[];
  active: string;
  onChange: (id: string) => void;
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const i = tabs.findIndex((t) => t.id === active);
    let next = -1;
    if (e.key === 'ArrowRight') next = (i + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') next = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    if (next < 0) return;
    e.preventDefault();
    onChange(tabs[next].id);
    ref.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  }

  return (
    <div
      ref={ref}
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className="flex gap-1 overflow-x-auto border-b border-line"
    >
      {tabs.map((t) => {
        const selected = t.id === active;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={selected}
            aria-controls={`panel-${t.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(t.id)}
            className={`min-h-11 shrink-0 border-b-2 px-3 text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
              selected ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

/** Instant switch with a very short opacity fade-in — no spring, this is the internal-tool area (R20). */
export function TabPanel({ id, active, children }: { id: string; active: boolean; children: ReactNode }) {
  if (!active) return null;
  return (
    <div
      role="tabpanel"
      id={`panel-${id}`}
      aria-labelledby={`tab-${id}`}
      tabIndex={0}
      className="animate-[settings-fade_120ms_ease-out] pt-6"
    >
      {children}
    </div>
  );
}
