/**
 * Google Places search for the booking admin.
 *
 * The Google API key is NEVER in the browser. Calls go to a Cloudflare Worker (worker/places-proxy) that
 * holds the key as a secret and only answers signed-in people who can run bookings. Set
 * VITE_PLACES_PROXY_URL to the Worker URL (see README, "Venue search (Google Places)").
 *
 * The chosen place becomes a Google Maps link so the guest-facing map is still Google's.
 *
 * Autocomplete predictions carry no coordinates: pick() in VenueSearch fetches them with
 * fetchPlaceDetails(place_id) (Places Details, geometry only) to build the pin link.
 */

export interface PlaceResult {
  /** One line to show in the list. */
  label: string;
  /** Place name (often the venue/establishment name). */
  name: string;
  /** City/town. */
  city: string;
  /** Place ID from Google Places Autocomplete response. */
  place_id?: string;
}

/** Error surfaced from Google Places API. */
export interface PlacesError {
  status: string;
  error_message?: string;
}

type TokenProvider = () => Promise<string | undefined>;

/** Default: the signed-in user's Firebase ID token. Loaded lazily so this module stays importable
 * (and unit-testable) without initialising Firebase. */
let getToken: TokenProvider = async () => {
  const { auth } = await import('./firebase');
  return auth.currentUser?.getIdToken();
};

/** Tests (or other auth setups) can replace how the ID token is obtained. */
export function setPlacesTokenProvider(fn: TokenProvider): void {
  getToken = fn;
}

/** GET {proxy}/{path}?params with the caller's ID token. Returns the parsed Google-shaped JSON. */
async function callProxy(
  path: 'autocomplete' | 'details',
  params: Record<string, string>,
  signal?: AbortSignal,
): Promise<{ data: Record<string, any> } | PlacesError> {
  const base = (import.meta.env.VITE_PLACES_PROXY_URL ?? '').replace(/\/+$/, '');
  if (!base) {
    return { status: 'NO_PROXY', error_message: 'Venue search is not configured (VITE_PLACES_PROXY_URL).' };
  }
  const token = await getToken();
  if (!token) return { status: 'UNAUTHENTICATED', error_message: 'Sign in to search venues.' };
  try {
    const res = await fetch(`${base}/${path}?${new URLSearchParams(params)}`, {
      signal,
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const body = await Promise.resolve().then(() => res.json()).catch(() => ({}));
      return { status: body.status ?? 'HTTP_ERROR', error_message: body.error_message ?? `HTTP ${res.status}: ${res.statusText}` };
    }
    return { data: await res.json() };
  } catch (e) {
    return { status: 'NETWORK_ERROR', error_message: e instanceof Error ? e.message : 'Unknown error' };
  }
}

/** A Google Maps link that drops a pin on the exact spot (embeddable by toMapEmbedUrl). */
export function googleMapsPinUrl(p: { lat: number; lng: number }): string {
  return `https://www.google.com/maps?q=${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;
}

/** Fetches place details (geometry) from Google Places Details API using place_id. */
export async function fetchPlaceDetails(
  placeId: string,
  signal?: AbortSignal
): Promise<{ lat: number; lng: number } | PlacesError> {
  const out = await callProxy('details', { place_id: placeId }, signal);
  if (!('data' in out)) return out;
  const data = out.data;
  if (data.status !== 'OK' || !data.result?.geometry?.location) {
    return { status: data.status, error_message: data.error_message };
  }
  const { lat, lng } = data.result.geometry.location;
  return { lat, lng };
}

/** Fetches predictions from the Google Places Autocomplete API. */
export async function searchPlaces(
  query: string,
  signal?: AbortSignal
): Promise<PlaceResult[] | PlacesError> {
  const q = query.trim();
  if (q.length < 3) return [];
  const out = await callProxy('autocomplete', { input: q }, signal);
  if (!('data' in out)) return out;
  const data = out.data;

  if (data.status === 'ZERO_RESULTS' || !data.predictions) {
    return [];
  }

  if (data.status !== 'OK') {
    return { status: data.status, error_message: data.error_message };
  }

  return data.predictions.map((p: {
    description: string;
    structured_formatting: { main_text: string; secondary_text: string };
    place_id: string;
  }) => {
    // Parse description like "Marina Beach, Chennai, Tamil Nadu"
    const descParts = p.description.split(',');
    const resultName = descParts[0].trim();
    const resultCityRaw = descParts.slice(1).join(',').trim();
    // Drop trailing parenthesised qualifiers
    const resultCity = resultCityRaw.replace(/\([^)]*\)/g, '').trim();

    // Try to extract city from secondary formatting (e.g., "Chennai, Tamil Nadu")
    const secondary = p.structured_formatting.secondary_text || '';
    const cityMatch = secondary.match(/([^,]+), ([^,]+)/);
    const extractedCity = cityMatch ? cityMatch[1].trim() : resultCity;

    const resultLabel =
      [resultName, extractedCity].filter(Boolean).join(', ') || q;

    return {
      label: resultLabel,
      name: resultName,
      city: extractedCity,
      place_id: p.place_id,
    };
  });
}