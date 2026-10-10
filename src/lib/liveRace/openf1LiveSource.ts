import { LiveNotConfiguredError, type LiveLapSnapshot, type LiveLapSource } from './types';

type TokenProvider = () => Promise<string | undefined>;

/** Default: the signed-in user's Firebase ID token. Loaded lazily so this module stays importable
 * (and unit-testable) without initialising Firebase. */
let getToken: TokenProvider = async () => {
  const { auth } = await import('../firebase');
  return auth.currentUser?.getIdToken();
};

/** Tests can replace how the ID token is obtained. */
export function setLiveTokenProvider(fn: TokenProvider | null): void {
  getToken = fn ?? (async () => {
    const { auth } = await import('../firebase');
    return auth.currentUser?.getIdToken();
  });
}

function baseUrl(): string {
  return ((import.meta.env.VITE_OPENF1_LIVE_URL ?? '') as string).trim().replace(/\/+$/, '');
}

/** Defensive parse of the Worker payload; null when it is not what we expect. */
export function parseLivePayload(raw: unknown, nowMs: number): LiveLapSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (o.configured !== true || o.source !== 'openf1-live') return null;
  const lap = o.lap;
  if (lap !== null && !(typeof lap === 'number' && Number.isInteger(lap) && lap >= 1 && lap <= 500)) return null;
  const parsedAt = typeof o.updatedAt === 'string' ? Date.parse(o.updatedAt) : NaN;
  const snap: LiveLapSnapshot = {
    lap,
    updatedAtMs: Number.isFinite(parsedAt) ? parsedAt : nowMs,
    source: 'openf1-live',
  };
  if (typeof o.sessionKey === 'number' && Number.isInteger(o.sessionKey)) snap.sessionKey = o.sessionKey;
  return snap;
}

export const openf1LiveSource: LiveLapSource = {
  id: 'openf1-live',
  label: 'OpenF1 live (paid, automatic)',
  configured: () => baseUrl() !== '',
  async fetchLap(signal) {
    const base = baseUrl();
    if (!base) throw new LiveNotConfiguredError();
    try {
      const token = await getToken();
      if (!token) return null;
      const res = await fetch(`${base}/v1/live/lap?session_key=latest`, {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });
      if (res.status === 503) {
        const body = (await res.json().catch(() => null)) as { configured?: unknown } | null;
        if (body && body.configured === false) throw new LiveNotConfiguredError();
        return null;
      }
      if (!res.ok) return null;
      return parseLivePayload(await res.json(), Date.now());
    } catch (e) {
      if (e instanceof LiveNotConfiguredError) throw e;
      return null;
    }
  },
};
