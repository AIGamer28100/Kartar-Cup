/**
 * Google Places search for the booking admin.
 *
 * Requires a Google Cloud API key with the Places API enabled.
 * Set VITE_GOOGLE_PLACES_API_KEY in your environment.
 *
 * The chosen place becomes a Google Maps link so the guest-facing map is still Google's.
 * Data is from Google Places, not OpenStreetMap.
 *
 * Note: Google Places Autocomplete returns predictions with description/structured_text but
 * does not include lat/lng directly. Use the place_id with the Places Details API to obtain
 * coordinates if needed: https://maps.googleapis.com/maps/api/place/details/json?place_id=PLACE_ID&fields=geometry&key=KEY
 */

export interface PlaceResult {
  /** One line to show in the list. */
  label: string;
  /** Place name (often the venue/establishment name). */
  name: string;
  /** City/town. */
  city: string;
  /** Latitude. */
  lat: number;
  /** Longitude. */
  lng: number;
  /** Place ID from Google Places Autocomplete response. */
  place_id?: string;
}

/** Error surfaced from Google Places API. */
export interface PlacesError {
  status: string;
  error_message?: string;
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
  const isDev = import.meta.env.DEV;
  const baseUrl = isDev
    ? '/api/places/details/json'
    : 'https://maps.googleapis.com/maps/api/place/details/json';

  try {
    const res = await fetch(
      `${baseUrl}?place_id=${encodeURIComponent(placeId)}&fields=geometry&key=${import.meta.env.VITE_GOOGLE_PLACES_API_KEY}`,
      { signal }
    );

    if (!res.ok) {
      return {
        status: 'HTTP_ERROR',
        error_message: `HTTP ${res.status}: ${res.statusText}`,
      };
    }

    const data = await res.json();

    if (data.status !== 'OK' || !data.result?.geometry?.location) {
      return {
        status: data.status,
        error_message: data.error_message,
      };
    }

    const { lat, lng } = data.result.geometry.location;
    return { lat, lng };
  } catch (e) {
    return {
      status: 'NETWORK_ERROR',
      error_message: e instanceof Error ? e.message : 'Unknown error',
    };
  }
}

/** Fetches predictions from the Google Places Autocomplete API. */
export async function searchPlaces(
  query: string,
  signal?: AbortSignal
): Promise<PlaceResult[] | PlacesError> {
  const q = query.trim();
  if (q.length < 3) return [];

  // Use Vite dev proxy in development to avoid CORS issues with Google Places API.
  // In production, the proxy won't exist, so we fall back to direct call (requires
  // API key with proper HTTP referrer restrictions for the production domain).
  const isDev = import.meta.env.DEV;
  const baseUrl = isDev
    ? '/api/places/autocomplete/json'
    : 'https://maps.googleapis.com/maps/api/place/autocomplete/json';

  try {
    const res = await fetch(
      `${baseUrl}?input=${encodeURIComponent(q)}&key=${import.meta.env.VITE_GOOGLE_PLACES_API_KEY}&language=en&components=country:in`,
      { signal }
    );

    if (!res.ok) {
      return {
        status: 'HTTP_ERROR',
        error_message: `HTTP ${res.status}: ${res.statusText}`,
      };
    }

    const data = await res.json();

    if (data.status === 'ZERO_RESULTS' || !data.predictions) {
      return [];
    }

    if (data.status !== 'OK') {
      return {
        status: data.status,
        error_message: data.error_message,
      };
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
      // Remove trailing state/country in parentheses that Photon-style parsing would include
      const resultCity = resultCityRaw.replace(/\([^)]*\)/g, '').trim();

      // Try to extract city from secondary formatting (e.g., "Chennai, Tamil Nadu")
      const secondary = p.structured_formatting.secondary_text || '';
      const cityMatch = secondary.match(/([^,]+), ([^,]+)/);
      const extractedCity = cityMatch ? cityMatch[1].trim() : resultCity;

      const resultLabel =
        [resultName, extractedCity].filter(Boolean).join(', ') || q;

      // Google Places Autocomplete does not return lat/lng directly.
      // We return placeholder coordinates (0,0) and provide the place_id
      // so callers can fetch details via the Places Details API if needed.
      return {
        label: resultLabel,
        name: resultName,
        city: extractedCity,
        lat: 0,
        lng: 0,
        place_id: p.place_id,
      };
    });
  } catch (e) {
    return {
      status: 'NETWORK_ERROR',
      error_message: e instanceof Error ? e.message : 'Unknown error',
    };
  }
}