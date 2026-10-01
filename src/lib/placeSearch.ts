/**
 * Free venue search for the booking admin: Photon (https://photon.komoot.io), a search service built
 * on OpenStreetMap data. No API key, no billing, CORS-open, and designed for search-as-you-type.
 * The chosen place becomes a Google Maps link so the guest-facing map is still Google's.
 * Data © OpenStreetMap contributors (shown next to the search box, as the licence asks).
 */

export interface PlaceResult {
  /** One line to show in the list. */
  label: string;
  name: string;
  city: string;
  lat: number;
  lng: number;
}

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    name?: string;
    housenumber?: string;
    street?: string;
    district?: string;
    city?: string;
    county?: string;
    state?: string;
    country?: string;
  };
}

/** Pure: Photon GeoJSON -> place results. Drops anything without usable coordinates or a name. */
export function parsePhoton(json: unknown): PlaceResult[] {
  const features = (json as { features?: PhotonFeature[] })?.features ?? [];
  const out: PlaceResult[] = [];
  const seen = new Set<string>();
  for (const f of features) {
    const c = f.geometry?.coordinates;
    const p = f.properties;
    if (!p || !c || c.length < 2 || !Number.isFinite(c[0]) || !Number.isFinite(c[1])) continue;
    const street = [p.housenumber, p.street].filter(Boolean).join(' ');
    const name = (p.name ?? street).trim();
    if (!name) continue;
    const city = (p.city ?? p.district ?? p.county ?? p.state ?? '').trim();
    const label = [name, p.name && street ? street : '', city, p.state && p.state !== city ? p.state : '']
      .filter(Boolean)
      .join(', ');
    const key = `${label}|${c[0].toFixed(4)}|${c[1].toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ label, name, city, lat: c[1], lng: c[0] });
  }
  return out;
}

/** A Google Maps link that drops a pin on the exact spot (embeddable by toMapEmbedUrl). */
export function googleMapsPinUrl(p: { lat: number; lng: number }): string {
  return `https://www.google.com/maps?q=${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;
}

/** Search for up to 5 places. Resolves to [] on any failure or an aborted request. */
export async function searchPlaces(query: string, signal?: AbortSignal): Promise<PlaceResult[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  try {
    const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=5&lang=en`, { signal });
    if (!res.ok) return [];
    return parsePhoton(await res.json());
  } catch {
    return [];
  }
}
