import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchDriverStandings, fetchSchedule } from '../lib/f1api';
import { clearNetCaches, getMockNetState, installMockNet, setScenario, uninstallMockNet } from './mockNet';

const OF1 = 'https://api.openf1.org/v1';
const realFetch = vi.fn(async () => new Response('real', { status: 200 }));
const origFetch = globalThis.fetch;

beforeEach(() => {
  globalThis.fetch = realFetch as unknown as typeof fetch;
  realFetch.mockClear();
});
afterEach(() => {
  uninstallMockNet();
  globalThis.fetch = origFetch;
  vi.unstubAllEnvs();
});

describe('mockNet', () => {
  it('install patches fetch and uninstall restores the original', () => {
    const before = globalThis.fetch;
    const off = installMockNet('completed');
    expect(globalThis.fetch).not.toBe(before);
    expect(getMockNetState().installed).toBe(true);
    off();
    expect(globalThis.fetch).toBe(before);
    expect(getMockNetState().installed).toBe(false);
  });

  it('install is idempotent and still restores the true original', () => {
    const before = globalThis.fetch;
    installMockNet('completed');
    installMockNet('no-data');
    expect(getMockNetState().scenario).toBe('no-data');
    uninstallMockNet();
    expect(globalThis.fetch).toBe(before);
  });

  it('completed serves captured Malaysia payloads, matching on path + params', async () => {
    installMockNet('completed');
    const res = await fetch(`${OF1}/session_result?session_key=11731&extra=1`);
    expect(res.status).toBe(200);
    const rows = (await res.json()) as { position: number }[];
    expect(rows.length).toBeGreaterThan(10);
    const sessions = (await (await fetch(`${OF1}/sessions?meeting_key=1308`)).json()) as { session_name: string }[];
    expect(sessions.some((s) => s.session_name === 'Race')).toBe(true);
    expect(realFetch).not.toHaveBeenCalled();
  });

  it('upcoming serves Singapore sessions but no session-keyed results', async () => {
    installMockNet('upcoming');
    const next = (await (await fetch(`${OF1}/sessions?meeting_key=1296`)).json()) as unknown[];
    expect(next.length).toBeGreaterThan(0);
    expect(await (await fetch(`${OF1}/session_result?session_key=11731`)).json()).toEqual([]);
  });

  it('no-data answers an empty array 200', async () => {
    installMockNet('no-data');
    const res = await fetch(`${OF1}/drivers?session_key=11731`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it('rate-limited answers 429 for OpenF1 only', async () => {
    installMockNet('rate-limited');
    expect((await fetch(`${OF1}/laps?session_key=11731`)).status).toBe(429);
    expect((await fetch('https://api.jolpi.ca/ergast/f1/2026.json?limit=40')).status).toBe(200);
  });

  it('offline rejects every intercepted fetch with a TypeError and logs it', async () => {
    installMockNet('offline');
    await expect(fetch(`${OF1}/sessions?meeting_key=1308`)).rejects.toBeInstanceOf(TypeError);
    expect(getMockNetState().calls.at(-1)).toMatchObject({ status: 'reject', served: 'offline' });
  });

  it('setScenario switches behaviour live', async () => {
    installMockNet('completed');
    setScenario('rate-limited');
    expect((await fetch(`${OF1}/drivers?session_key=11731`)).status).toBe(429);
  });

  it('unmatched intercepted URLs get an empty-fallback, never the network', async () => {
    installMockNet('completed');
    const res = await fetch(`${OF1}/pit?session_key=11731`);
    expect(await res.json()).toEqual([]);
    expect(getMockNetState().calls.at(-1)?.served).toBe('empty-fallback');
    expect(realFetch).not.toHaveBeenCalled();
  });

  it('serves Jolpica, Open-Meteo and image placeholders', async () => {
    installMockNet('completed');
    expect(await fetchSchedule(2026)).not.toBeNull();
    expect(await fetchDriverStandings(2026)).not.toBeNull();
    const meteo = await fetch('https://api.open-meteo.com/v1/forecast?latitude=1&longitude=2&hourly=temperature_2m');
    expect(((await meteo.json()) as { hourly: unknown }).hourly).toBeDefined();
    const img = await fetch('https://media.formula1.com/x/y.png');
    expect(img.headers.get('content-type')).toBe('image/svg+xml');
  });

  it('answers the Places proxy origin from the places fixtures', async () => {
    vi.stubEnv('VITE_PLACES_PROXY_URL', 'https://places.example.workers.dev/');
    installMockNet('completed');
    const ac = (await (await fetch('https://places.example.workers.dev/autocomplete?input=chen')).json()) as { predictions: unknown[] };
    expect(ac.predictions.length).toBeGreaterThanOrEqual(3);
    const det = (await (await fetch('https://places.example.workers.dev/details?place_id=abc')).json()) as {
      result: { geometry: { location: { lat: number } } };
    };
    expect(typeof det.result.geometry.location.lat).toBe('number');
    expect(realFetch).not.toHaveBeenCalled();
  });

  it('passes unrelated URLs straight through', async () => {
    installMockNet('offline');
    const logged = getMockNetState().calls.length;
    const res = await fetch('https://example.com/data');
    expect(await res.text()).toBe('real');
    expect(realFetch).toHaveBeenCalledTimes(1);
    expect(getMockNetState().calls).toHaveLength(logged);
  });

  it('caps the call log at 200', async () => {
    installMockNet('no-data');
    for (let i = 0; i < 230; i++) await fetch(`${OF1}/drivers?session_key=${i}`);
    expect(getMockNetState().calls).toHaveLength(200);
    expect(getMockNetState().calls.at(-1)?.url).toContain('session_key=229');
  });

  // A panel may layer its own scoped fetch shim on top of Mock Net (ResultsPanel's loading/error
  // Cases and HostPanel's Places shapes both do). Switching Mock Net off while one is mounted must
  // still hand the real fetch back, or the page is stuck on fixtures with the switch reading "off".
  it('uninstall restores the real fetch even when a panel shim is layered on top', async () => {
    const before = globalThis.fetch;
    installMockNet('completed');
    const layered = globalThis.fetch;
    const shim: typeof fetch = async (input, init) => layered(input, init);
    globalThis.fetch = shim;

    uninstallMockNet();
    expect(globalThis.fetch).toBe(before);
    expect(getMockNetState().installed).toBe(false);
    // An OpenF1 URL must now reach the real fetch, not keep being served from fixtures.
    expect(await (await fetch(`${OF1}/sessions?meeting_key=1308`)).text()).toBe('real');
    expect(realFetch).toHaveBeenCalledTimes(1);

    // The shim's own cleanup runs later and must not put the dead interceptor back.
    if (globalThis.fetch === shim) globalThis.fetch = layered;
    expect(globalThis.fetch).toBe(before);
  });

  it('clearNetCaches removes only rd: and jolpica: keys', () => {
    const store = new Map<string, string>([['rd:a', '1'], ['jolpica:b', '2'], ['keep', '3']]);
    vi.stubGlobal('sessionStorage', {
      get length() { return store.size; },
      key: (i: number) => [...store.keys()][i] ?? null,
      removeItem: (k: string) => void store.delete(k),
    });
    clearNetCaches();
    expect([...store.keys()]).toEqual(['keep']);
    vi.unstubAllGlobals();
  });
});

