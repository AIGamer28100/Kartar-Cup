/**
 * Lazy route modules, shared by App.tsx (React.lazy) and the route-transition layer, which preloads
 * the destination's chunk while the cover animates (and on link hover/focus/touch), so the new page
 * is usually ready the instant the overlay covers the screen: no skeleton flash mid-transition.
 */

export const load = {
  home: () => import('./guest/HomePage'),
  events: () => import('./guest/EventsPage'),
  checkout: () => import('./guest/BookingCheckout'),
  gallery: () => import('./guest/GalleryPage'),
  cup: () => import('./guest/CupPage'),
  race: () => import('./guest/RaceDetailPage'),
  profile: () => import('./guest/ProfilePage'),
  ticket: () => import('./guest/TicketView'),
  about: () => import('./guest/AboutPage'),
  contact: () => import('./guest/ContactPage'),
  content: () => import('./guest/ContentPages'),
  legal: () => import('./guest/LegalPages'),
  join: () => import('./pages/JoinPage'),
} as const;

const MATCH: [RegExp, () => Promise<unknown>][] = [
  [/^\/$/, load.home],
  [/^\/events$/, load.events],
  [/^\/events\/[^/]+$/, load.checkout],
  [/^\/races\/[^/]+$/, load.race],
  [/^\/gallery$/, load.gallery],
  [/^\/cup$/, load.cup],
  [/^\/profile$/, load.profile],
  [/^\/tickets\/[^/]+$/, load.ticket],
  [/^\/about$/, load.about],
  [/^\/contact$/, load.contact],
  [/^\/(partners|stories)(\/[^/]+)?$/, load.content],
  [/^\/(terms|privacy)$/, load.legal],
  [/^\/join\/[^/]+$/, load.join],
];

const pending = new Map<() => Promise<unknown>, Promise<void>>();

/** Start (or reuse) loading the code for a public path. Resolves when ready; never rejects (a
 * failed chunk load is left to the route's own Suspense/ErrorBoundary). */
export function preloadRoute(pathname: string): Promise<void> {
  const p = pathname.split(/[?#]/)[0].replace(/(.)\/+$/, '$1') || '/';
  const hit = MATCH.find(([re]) => re.test(p));
  if (!hit) return Promise.resolve();
  const loader = hit[1];
  let pr = pending.get(loader);
  if (!pr) {
    pr = loader().then(
      () => undefined,
      () => {
        pending.delete(loader);
      },
    );
    pending.set(loader, pr);
  }
  return pr;
}
