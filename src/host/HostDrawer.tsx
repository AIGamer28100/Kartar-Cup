import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import {
  Broadcast,
  ClipboardText,
  FlagCheckered,
  List,
  Newspaper,
  QrCode,
  Ticket,
  Users,
  X,
  type Icon,
} from '@phosphor-icons/react';
import { NavLink } from 'react-router';
import { NAV_GROUPS, type NavItem } from './nav';

const STORAGE_KEY = 'kc.host.nav.open';
const DRAWER_ID = 'host-sections-drawer';
const DESKTOP_QUERY = '(min-width: 768px)';

const ICONS: Record<string, Icon> = {
  console: Broadcast,
  bookings: Ticket,
  checkin: QrCode,
  league: FlagCheckered,
  content: Newspaper,
  users: Users,
  audit: ClipboardText,
};

const focusCls = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

/** Active = ink text + semibold + a 3px accent bar, so it does not rely on colour alone. */
const linkCls = `relative flex min-h-11 items-center gap-3 rounded-md px-3 text-sm text-muted hover:bg-raised hover:text-ink ${focusCls} aria-[current=page]:bg-raised aria-[current=page]:font-semibold aria-[current=page]:text-ink aria-[current=page]:shadow-[inset_3px_0_0_0_var(--color-accent)]`;

/** md and up: the drawer pushes the content aside instead of covering it. */
function useIsDesktop(): boolean {
  const [desktop, setDesktop] = useState(() => window.matchMedia(DESKTOP_QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_QUERY);
    const on = () => setDesktop(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return desktop;
}

/** The host's last choice wins; with none stored it starts open on desktop and closed on a phone. */
const readOpen = (): boolean => {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === '1') return true;
    if (v === '0') return false;
  } catch {
    /* storage blocked: fall through to the viewport default */
  }
  return window.matchMedia(DESKTOP_QUERY).matches;
};

const writeOpen = (open: boolean): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, open ? '1' : '0');
  } catch {
    /* storage blocked: the choice just does not persist */
  }
};

export interface HostDrawerState {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  burgerRef: RefObject<HTMLButtonElement>;
}

export function useHostDrawer(): HostDrawerState {
  const [open, setOpenState] = useState(readOpen);
  const burgerRef = useRef<HTMLButtonElement>(null);
  const setOpen = useCallback((v: boolean) => {
    setOpenState(v);
    writeOpen(v);
  }, []);
  const toggle = useCallback(() => {
    setOpenState((o) => {
      writeOpen(!o);
      return !o;
    });
  }, []);
  return { open, setOpen, toggle, burgerRef };
}

/** The header button that opens and closes the drawer. */
export function HostBurger({ state }: { state: HostDrawerState }) {
  return (
    <button
      ref={state.burgerRef}
      type="button"
      aria-expanded={state.open}
      aria-controls={DRAWER_ID}
      aria-label={state.open ? 'Close sections' : 'Open sections'}
      onClick={state.toggle}
      className={`inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-ink hover:bg-raised ${focusCls}`}
    >
      <List size={24} weight="regular" aria-hidden="true" />
    </button>
  );
}

const FOCUSABLE = 'a[href], button:not([disabled])';

/** Grouped section nav. Open by default; on md+ it pushes the content aside (HostFrame pads by its width),
 * on a phone it overlays with a backdrop, traps focus, and closes after a link is chosen. */
export function HostDrawer({ items, state }: { items: NavItem[]; state: HostDrawerState }) {
  const { open, setOpen, burgerRef } = state;
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(open);
  const desktop = useIsDesktop();

  // A closed drawer is off-screen: keep it out of the tab order and the accessibility tree.
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    if (open) el.removeAttribute('inert');
    else el.setAttribute('inert', '');
  }, [open]);

  // Focus follows the toggle: back to the burger on close, into the panel on open (phones only).
  useEffect(() => {
    if (open === wasOpen.current) return;
    wasOpen.current = open;
    if (!open) {
      burgerRef.current?.focus();
      return;
    }
    if (!desktop) closeRef.current?.focus();
  }, [open, burgerRef, desktop]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (e.key !== 'Tab' || desktop) return;
      const f = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!f || f.length === 0) return;
      const first = f[0];
      const last = f[f.length - 1];
      const active = document.activeElement;
      if (!panelRef.current?.contains(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, setOpen, desktop]);

  return (
    <>
      <div
        aria-hidden="true"
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-40 bg-black/60 transition-opacity md:hidden duration-150 motion-reduce:transition-none ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />
      <div
        ref={panelRef}
        id={DRAWER_ID}
        role="dialog"
        aria-modal={!desktop}
        aria-label="Host sections"
        className={`fixed left-0 top-0 z-50 flex h-[100dvh] w-64 max-w-[85vw] flex-col border-r border-line bg-base text-ink transition-transform duration-150 ease-out motion-reduce:transition-none ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <nav aria-label="Host sections" className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-3">
          {NAV_GROUPS.map((g) => {
            const inGroup = items.filter((n) => n.group === g.id);
            if (inGroup.length === 0) return null;
            return (
              <div key={g.id} className={g.id === 'reference' ? 'border-t border-line pt-4' : undefined}>
                <p className="px-3 pb-1 font-mono text-xs uppercase tracking-widest text-muted">{g.label}</p>
                <ul className="space-y-0.5">
                  {inGroup.map((n) => {
                    const I = ICONS[n.id];
                    return (
                      <li key={n.id}>
                        <NavLink to={n.to} end={n.end} className={linkCls} onClick={() => !desktop && setOpen(false)}>
                          {I && <I size={20} weight="regular" aria-hidden="true" />} {n.label}
                        </NavLink>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>
        <div className="shrink-0 border-t border-line p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            ref={closeRef}
            type="button"
            onClick={() => setOpen(false)}
            className={`flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-line bg-raised text-sm font-medium text-ink hover:border-muted ${focusCls}`}
          >
            <X size={18} weight="regular" aria-hidden="true" /> Close
          </button>
        </div>
      </div>
    </>
  );
}
