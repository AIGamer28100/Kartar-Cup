import { describe, expect, it } from 'vitest';
import { googleMapsPinUrl, parsePhoton } from './placeSearch';
import { toMapEmbedUrl } from './mapEmbed';

// Shape copied from a real photon.komoot.io response.
const feature = (props: Record<string, unknown>, coordinates: [number, number] = [80.2598, 12.9858]) => ({
  geometry: { coordinates },
  properties: props,
});

describe('parsePhoton', () => {
  it('maps a named place, taking [lng, lat] order from GeoJSON', () => {
    const [r] = parsePhoton({
      features: [feature({ name: 'Marina Beach', city: 'Chennai', state: 'Tamil Nadu' }, [80.2833, 13.0534])],
    });
    expect(r).toMatchObject({ name: 'Marina Beach', city: 'Chennai', lat: 13.0534, lng: 80.2833 });
    expect(r.label).toBe('Marina Beach, Chennai, Tamil Nadu');
  });

  it('falls back to district/county for the city and to the street for a nameless address', () => {
    const [r] = parsePhoton({ features: [feature({ housenumber: '12', street: 'East Coast Road', county: 'Chengalpattu' })] });
    expect(r.name).toBe('12 East Coast Road');
    expect(r.city).toBe('Chengalpattu');
  });

  it('drops results with no name or no usable coordinates, and de-duplicates', () => {
    const out = parsePhoton({
      features: [
        feature({ city: 'Chennai' }),
        { properties: { name: 'No coords' } },
        feature({ name: 'Dup', city: 'Chennai' }),
        feature({ name: 'Dup', city: 'Chennai' }),
      ],
    });
    expect(out.map((r) => r.name)).toEqual(['Dup']);
  });

  it('returns [] for junk input', () => {
    expect(parsePhoton(null)).toEqual([]);
    expect(parsePhoton({})).toEqual([]);
  });
});

describe('googleMapsPinUrl', () => {
  it('builds a pin link that the guest page can embed', () => {
    const url = googleMapsPinUrl({ lat: 12.9858, lng: 80.2598 });
    expect(url).toBe('https://www.google.com/maps?q=12.985800,80.259800');
    expect(toMapEmbedUrl(url)).toContain('output=embed');
  });
});
