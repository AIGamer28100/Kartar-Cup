import { NavLink } from 'react-router';

export interface LinkTabDef {
  id: string;
  label: string;
  /** Path relative to the parent route (e.g. 'details'). */
  to: string;
}

/** Route-backed tabs: real links, one URL each, Back moves between them. Quiet by design (R20): no motion. */
export function LinkTabs({ tabs, label }: { tabs: LinkTabDef[]; label: string }) {
  return (
    <nav aria-label={label} className="flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map((t) => (
        <NavLink
          key={t.id}
          to={t.to}
         
          className="inline-flex min-h-11 shrink-0 items-center border-b-2 border-transparent px-3 text-sm font-medium text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent aria-[current=page]:border-accent aria-[current=page]:font-semibold aria-[current=page]:text-ink"
        >
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}
