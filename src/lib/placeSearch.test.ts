import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { googleMapsPinUrl, searchPlaces, setPlacesTokenProvider, type PlacesError } from './placeSearch';
import type { PlaceResult } from './placeSearch';

// Google Places Autocomplete returns predictions with these fields.
// A minimal prediction shape matching the real API response.
const minimalPrediction = {
  description: 'Marina Beach, Chennai, Tamil Nadu',
  structured_formatting: {
    main_text: 'Marina Beach',
    secondary_text: 'Chennai, Tamil Nadu',
  },
  place_id: 'ChIInEezR91Ak8gR6YFW1U_r Mor',
};

describe('googleMapsPinUrl', () => {
  it('builds a pin link that the guest page can embed', () => {
    const url = googleMapsPinUrl({ lat: 12.9858, lng: 80.2598 });
    expect(url).toBe('https://www.google.com/maps?q=12.985800,80.259800');
  });
});

describe('searchPlaces', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_PLACES_PROXY_URL', 'https://places.example.workers.dev/');
    setPlacesTokenProvider(async () => 'test-id-token');
  });
  afterEach(() => { vi.unstubAllEnvs(); });

  it('reports NO_PROXY instead of calling anything when the proxy URL is missing', async () => {
    vi.stubEnv('VITE_PLACES_PROXY_URL', '');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const out = await searchPlaces('marina beach');
    expect((out as PlacesError).status).toBe('NO_PROXY');
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('asks the user to sign in when there is no ID token, and never calls the proxy', async () => {
    setPlacesTokenProvider(async () => undefined);
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const out = await searchPlaces('marina beach');
    expect((out as PlacesError).status).toBe('UNAUTHENTICATED');
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('calls the proxy with the ID token and no Google key anywhere in the request', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'ZERO_RESULTS', predictions: [] }) });
    (global as any).fetch = fetchMock;
    await searchPlaces('Marina Beach');
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('https://places.example.workers.dev/autocomplete?input=Marina+Beach');
    expect(String(url)).not.toMatch(/key=/i);
    expect((init as RequestInit).headers).toEqual({ Authorization: 'Bearer test-id-token' });
  });

  // Type guard to narrow the union type
  const isPlaceResultArray = (results: PlaceResult[] | PlacesError): results is PlaceResult[] => {
    return Array.isArray(results);
  };

  it('returns empty array for short query', async () => {
    const results = await Promise.resolve(
      (await import('../lib/placeSearch')).searchPlaces('go')
    );
    expect(results).toEqual([]);
  });

  it('returns empty array for empty query', async () => {
    const results = await Promise.resolve(
      (await import('../lib/placeSearch')).searchPlaces('')
    );
    expect(results).toEqual([]);
  });

  it('fetches and parses Google Places Autocomplete predictions', async () => {
    // Mock the fetch API
    ;(global as any).fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: 'OK',
        predictions: [minimalPrediction as any],
        error_message: undefined,
      }),
    });

    const { searchPlaces } = await import('../lib/placeSearch');
    const results = await searchPlaces('Marina Beach');

    expect(isPlaceResultArray(results)).toBe(true);
    const places = results as PlaceResult[];
    expect(places).toHaveLength(1);
    expect(places[0].label).toBe('Marina Beach, Chennai');
    expect(places[0].name).toBe('Marina Beach');
    expect(places[0].city).toBe('Chennai');
    expect(places[0]).not.toHaveProperty('lat');
    expect(places[0].place_id).toBe('ChIInEezR91Ak8gR6YFW1U_r Mor');
  });

  it('returns empty array when API returns ZERO_RESULTS status', async () => {
    ;(global as any).fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: 'ZERO_RESULTS',
        predictions: [],
      }),
    });

    const { searchPlaces } = await import('../lib/placeSearch');
    const results = await searchPlaces('NonExistentPlace');

    expect(isPlaceResultArray(results)).toBe(true);
    expect(results).toEqual([]);
  });

  it('returns PlacesError when API returns REQUEST_DENIED status', async () => {
    ;(global as any).fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: 'REQUEST_DENIED',
        error_message: 'The provided API key is invalid.',
        predictions: [],
      }),
    });

    const { searchPlaces } = await import('../lib/placeSearch');
    const results = await searchPlaces('Marina Beach');

    expect(isPlaceResultArray(results)).toBe(false);
    const error = results as PlacesError;
    expect(error.status).toBe('REQUEST_DENIED');
    expect(error.error_message).toBe('The provided API key is invalid.');
  });

  it('returns PlacesError when API returns OVER_QUERY_LIMIT status', async () => {
    ;(global as any).fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: 'OVER_QUERY_LIMIT',
        error_message: 'You have exceeded your daily request quota for this API.',
        predictions: [],
      }),
    });

    const { searchPlaces } = await import('../lib/placeSearch');
    const results = await searchPlaces('Marina Beach');

    expect(isPlaceResultArray(results)).toBe(false);
    const error = results as PlacesError;
    expect(error.status).toBe('OVER_QUERY_LIMIT');
    expect(error.error_message).toContain('exceeded');
  });

  it('returns PlacesError when API returns INVALID_REQUEST status', async () => {
    ;(global as any).fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: 'INVALID_REQUEST',
        error_message: 'Missing required parameter: input.',
        predictions: [],
      }),
    });

    const { searchPlaces } = await import('../lib/placeSearch');
    const results = await searchPlaces('Marina Beach');

    expect(isPlaceResultArray(results)).toBe(false);
    const error = results as PlacesError;
    expect(error.status).toBe('INVALID_REQUEST');
  });

  it('returns PlacesError on HTTP error (non-ok response)', async () => {
    ;(global as any).fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
    });

    const { searchPlaces } = await import('../lib/placeSearch');
    const results = await searchPlaces('Marina Beach');

    expect(isPlaceResultArray(results)).toBe(false);
    const error = results as PlacesError;
    expect(error.status).toBe('HTTP_ERROR');
    expect(error.error_message).toContain('403');
  });

  it('returns PlacesError on network failure', async () => {
    ;(global as any).fetch = vi.fn().mockRejectedValueOnce(new Error('Failed to fetch'));

    const { searchPlaces } = await import('../lib/placeSearch');
    const results = await searchPlaces('Marina Beach');

    expect(isPlaceResultArray(results)).toBe(false);
    const error = results as PlacesError;
    expect(error.status).toBe('NETWORK_ERROR');
    expect(error.error_message).toBe('Failed to fetch');
  });
});