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
