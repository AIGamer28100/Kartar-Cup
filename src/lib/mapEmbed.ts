/** Pure: convert a Google Maps "Share" URL into a no-API-key embeddable iframe src using the
 * `output=embed` parameter. Returns null when the URL isn't a recognizably embeddable Google Maps
 * URL — this includes short links (maps.app.goo.gl, goo.gl/maps) which redirect server-side and
 * can't be resolved client-side; callers should fall back to a plain "Open in Google Maps" link. */
export function toMapEmbedUrl(mapUrl: string): string | null {
  const trimmed = mapUrl.trim();
  if (!trimmed) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase();
  const isGoogleMapsHost = host === 'maps.google.com' || host === 'www.google.com' || host === 'google.com';
  if (!isGoogleMapsHost) return null;
  if (!url.pathname.startsWith('/maps')) return null;

  if (url.searchParams.get('output') === 'embed') return trimmed;

  const q = url.searchParams.get('q');
  if (url.pathname === '/maps' && q) {
    return `https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed`;
  }

  const sep = trimmed.includes('?') ? '&' : '?';
  return `${trimmed}${sep}output=embed`;
}

export interface VenueLike {
  name: string;
  city: string;
  mapUrl?: string;
  place_id?: string;
}

const placeQuery = (v: VenueLike) => [v.name.trim(), v.city.trim()].filter(Boolean).join(', ');

/** Embed src for a venue: the host's pasted link when it can be embedded, otherwise a Google Maps
 * search for "name, city" — so a venue always gets a real map without the host hunting for a
 * share link (or us needing a Maps API key). Null only when there is no venue name at all. */
export function venueEmbedUrl(v: VenueLike): string | null {
  const fromLink = v.mapUrl ? toMapEmbedUrl(v.mapUrl) : null;
  if (fromLink) return fromLink;
  if (!v.name.trim()) return null;
  // Use place_id for exact venue embed if available
  if (v.place_id) {
    return `https://www.google.com/maps/embed/v1/place?key=AIzaSyCcUnPz_Ic1KWIPjH0uRbgCB39tUKr9NDk&q=place_id:${v.place_id}`;
  }
  return `https://www.google.com/maps?q=${encodeURIComponent(placeQuery(v))}&output=embed`;
}

/** Where "Open in Google Maps" goes: the host's own link if given, else a search for the venue. */
export function venueMapLink(v: VenueLike): string {
  const own = v.mapUrl?.trim();
  if (own && /^https?:\/\//i.test(own)) return own;
  // Use place_id for exact place link if available
  if (v.place_id) {
    return `https://www.google.com/maps/place/?q=place_id:${v.place_id}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeQuery(v))}`;
}

/** Turn-by-turn directions from wherever the guest is (Google fills in their location). */
export function venueDirectionsUrl(v: VenueLike): string {
  if (v.place_id) {
    return `https://www.google.com/maps/dir/?api=1&destination=place_id:${v.place_id}`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(placeQuery(v))}`;
}
