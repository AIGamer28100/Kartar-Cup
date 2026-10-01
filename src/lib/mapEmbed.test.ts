import { describe, expect, it } from 'vitest';
import { toMapEmbedUrl, venueDirectionsUrl, venueEmbedUrl, venueMapLink } from './mapEmbed';

describe('toMapEmbedUrl', () => {
  it('converts a google.com/maps?q= URL to an embed URL', () => {
    expect(toMapEmbedUrl('https://www.google.com/maps?q=Eiffel+Tower')).toBe(
      'https://www.google.com/maps?q=Eiffel%20Tower&output=embed',
    );
  });

  it('appends output=embed to a google.com/maps/place/... URL', () => {
    expect(toMapEmbedUrl('https://www.google.com/maps/place/Some+Place/@1,2,3z')).toBe(
      'https://www.google.com/maps/place/Some+Place/@1,2,3z?output=embed',
    );
  });

  it('returns null for a maps.app.goo.gl short link', () => {
    expect(toMapEmbedUrl('https://maps.app.goo.gl/abc123')).toBeNull();
  });

  it('returns null for a goo.gl/maps short link', () => {
    expect(toMapEmbedUrl('https://goo.gl/maps/abc123')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(toMapEmbedUrl('')).toBeNull();
  });

  it('returns null for a non-maps URL', () => {
    expect(toMapEmbedUrl('https://example.com')).toBeNull();
  });

  it('is idempotent when output=embed is already present', () => {
    const url = 'https://www.google.com/maps/place/Foo?output=embed';
    expect(toMapEmbedUrl(url)).toBe(url);
  });
});

describe('venue helpers', () => {
  const venue = { name: 'ECR Speedway Lounge', city: 'Chennai' };

  it('embeds the pasted link when it is embeddable', () => {
    const v = { ...venue, mapUrl: 'https://www.google.com/maps?q=ECR+Speedway&output=embed' };
    expect(venueEmbedUrl(v)).toBe('https://www.google.com/maps?q=ECR+Speedway&output=embed');
  });

  it('falls back to a name+city search when there is no link', () => {
    expect(venueEmbedUrl(venue)).toBe(
      'https://www.google.com/maps?q=ECR%20Speedway%20Lounge%2C%20Chennai&output=embed',
    );
  });

  it('falls back to name+city for a short link that cannot be embedded', () => {
    expect(venueEmbedUrl({ ...venue, mapUrl: 'https://maps.app.goo.gl/abc123' })).toContain('ECR%20Speedway');
  });

  it('has nothing to embed without a venue name', () => {
    expect(venueEmbedUrl({ name: '  ', city: 'Chennai' })).toBeNull();
  });

  it('opens the host link if given, else a search; directions always target the venue', () => {
    expect(venueMapLink({ ...venue, mapUrl: 'https://maps.app.goo.gl/abc123' })).toBe('https://maps.app.goo.gl/abc123');
    expect(venueMapLink(venue)).toBe(
      'https://www.google.com/maps/search/?api=1&query=ECR%20Speedway%20Lounge%2C%20Chennai',
    );
    expect(venueMapLink({ ...venue, mapUrl: 'javascript:alert(1)' })).toContain('/maps/search/');
    expect(venueDirectionsUrl(venue)).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=ECR%20Speedway%20Lounge%2C%20Chennai',
    );
  });
});
