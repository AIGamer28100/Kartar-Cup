export const isHostPath = (path: string): boolean => path === '/host' || path.startsWith('/host/');

export type RouteDecision =
  | { kind: 'render' }
  | { kind: 'loading' }
  | { kind: 'redirect'; to: string };

export interface RouteInput {
  path: string;
  /** Signed in with a non-anonymous Google account. */
  user: boolean;
  /** undefined while the host allowlist lookup is in flight. */
  isHost: boolean | undefined;
  /** Auth state not resolved yet. */
  loading: boolean;
}

/** Client-side UX guard. Firestore rules remain the real security boundary. */
export function decideRoute({ path, user, isHost, loading }: RouteInput): RouteDecision {
  if (!isHostPath(path)) return { kind: 'render' };
  if (loading) return { kind: 'loading' };
  if (!user) return { kind: 'redirect', to: '/' };
  if (isHost === undefined) return { kind: 'loading' };
  return isHost ? { kind: 'render' } : { kind: 'redirect', to: '/' };
}
