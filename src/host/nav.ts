/** Single source of truth for the host console's sections and URLs (paths are relative to /host).
 * HostApp builds its <Route> table from SECTION/TAB constants and renders HOST_NAV; nav.test.ts keeps
 * the nav and HOST_ROUTE_TABLE in step so a link can never point at a path with no route. */

export type NavGate = 'any' | 'host';
export type NavGroupId = 'daily' | 'setup' | 'admin' | 'reference';

export interface NavItem {
  id: string;
  label: string;
  /** Absolute path. */
  to: string;
  /** 'any' = venue_host and host; 'host' = isHost only (unchanged from the old tab bar). */
  gate: NavGate;
  group: NavGroupId;
  /** Match the exact path only (Console is the /host index). */
  end?: boolean;
  /** Shown as a direct slot in the phone bottom bar; the rest live under More. */
  primary?: boolean;
}

export const NAV_GROUPS: { id: NavGroupId; label: string }[] = [
  { id: 'daily', label: 'Day to day' },
  { id: 'setup', label: 'Set up' },
  { id: 'admin', label: 'Admin' },
  { id: 'reference', label: 'Reference' },
];

export const SECTION = {
  /** Retired (R57): the quiz editor moved into each booking event. Kept only as a redirect for old bookmarks. */
  settings: 'settings',
  bookings: 'bookings',
  league: 'league',
  checkin: 'checkin',
  auditLog: 'audit-log',
  content: 'content',
  users: 'users',
  more: 'menu',
} as const;

/** Tabs of a booking event's quiz editor (one shared form). `results` is NOT one of them: it is a sibling
 * route, `bookings/:eventId/quiz/results`, outside the form layout, so a tab id can never collide with it. */
export const QUIZ_TABS = [
  { id: 'details', label: 'Details' },
  { id: 'grid', label: 'Grid' },
  { id: 'teams', label: 'Teams' },
  { id: 'questions', label: 'Questions' },
] as const;
export const QUIZ_RESULTS = { id: 'results', label: 'Results' } as const;

/** Absolute URL of a booking event's quiz page (`tab` defaults to the first editor tab). */
export const quizPath = (eventId: string, tab: string = QUIZ_TABS[0].id): string =>
  `/host/${SECTION.bookings}/${eventId}/quiz/${tab}`;

export const CONTENT_TABS = [
  { id: 'partners', label: 'Partners' },
  { id: 'stories', label: 'Stories' },
  { id: 'legal', label: 'Legal documents' },
] as const;

export const HOST_NAV: NavItem[] = [
  { id: 'console', label: 'Console', to: '/host', gate: 'host', group: 'daily', end: true, primary: true },
  { id: 'bookings', label: 'Bookings', to: `/host/${SECTION.bookings}`, gate: 'any', group: 'daily', primary: true },
  { id: 'checkin', label: 'Check-in', to: `/host/${SECTION.checkin}`, gate: 'any', group: 'daily', primary: true },
  { id: 'league', label: 'Karting league', to: `/host/${SECTION.league}`, gate: 'host', group: 'setup' },
  { id: 'content', label: 'Content', to: `/host/${SECTION.content}`, gate: 'host', group: 'setup' },
  { id: 'users', label: 'People', to: `/host/${SECTION.users}`, gate: 'host', group: 'admin' },
  { id: 'audit', label: 'Audit log', to: `/host/${SECTION.auditLog}`, gate: 'host', group: 'reference' },
];

/** Items a signed-in user may see (same gating as before: venue_host = Bookings + Check-in). */
export const visibleNav = (isHost: boolean): NavItem[] => HOST_NAV.filter((n) => n.gate === 'any' || isHost);

export interface RouteEntry {
  /** Path relative to /host ('' = index). */
  path: string;
  /** Present for redirects: relative target path. */
  redirectTo?: string;
  /** Opened in its own window, not reached from the nav (so it needs no nav item). */
  standalone?: boolean;
}

/** Every route HostApp serves, as data. Keep in step with the JSX in HostApp (it uses the same constants). */
export const HOST_ROUTE_TABLE: RouteEntry[] = [
  { path: '' },
  { path: SECTION.more, redirectTo: '' },
  // Old bookmarks to the retired global quiz editor land on the bookings list (R57).
  { path: `${SECTION.settings}/*`, redirectTo: SECTION.bookings },
  { path: SECTION.bookings },
  { path: `${SECTION.bookings}/new` },
  { path: `${SECTION.bookings}/:eventId/edit` },
  { path: `${SECTION.bookings}/:eventId/attendees` },
  { path: `${SECTION.bookings}/:eventId/cards` },
  { path: `${SECTION.bookings}/:eventId/quiz`, redirectTo: `${SECTION.bookings}/:eventId/quiz/${QUIZ_TABS[0].id}` },
  ...QUIZ_TABS.map((t) => ({ path: `${SECTION.bookings}/:eventId/quiz/${t.id}` })),
  { path: `${SECTION.bookings}/:eventId/quiz/${QUIZ_RESULTS.id}` },
  { path: SECTION.league },
  { path: `${SECTION.league}/:seasonId` },
  { path: 'cup', redirectTo: SECTION.league },
  { path: SECTION.checkin },
  { path: SECTION.auditLog },
  { path: 'activity', redirectTo: SECTION.auditLog },
  { path: SECTION.content, redirectTo: `${SECTION.content}/${CONTENT_TABS[0].id}` },
  ...CONTENT_TABS.map((t) => ({ path: `${SECTION.content}/${t.id}` })),
  { path: SECTION.users },
  // The live overlay's standalone window (the popup fallback when Document Picture-in-Picture is unavailable).
  { path: 'overlay', standalone: true },
];
