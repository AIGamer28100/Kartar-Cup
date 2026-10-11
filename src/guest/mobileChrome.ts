export type TabId = 'home' | 'events' | 'profile';

/** Paths that never get the public mobile chrome (tab bar). Matched on whole segments. /play is the
 * private quiz page, which has its own chrome. */
const HIDDEN_ROOTS = ['host', 'logout', 'error', 'join', 'play'];

const segments = (path: string): string[] => path.split(/[?#]/)[0].split('/').filter(Boolean);

/** Whether the mobile tab bar belongs on this path. */
export function chromeVisible(path: string): boolean {
  const [root] = segments(path);
  return !(root && HIDDEN_ROOTS.includes(root));
}

/** Which tab is current for a path; pages with no tab (gallery, 404) return null. */
export function activeTab(path: string): TabId | null {
  const [root] = segments(path);
  if (!root) return 'home';
  if (root === 'events') return 'events';
  if (root === 'profile' || root === 'tickets') return 'profile';
  return null;
}
