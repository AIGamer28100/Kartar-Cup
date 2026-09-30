import { describe, expect, it } from 'vitest';
import { toMapEmbedUrl } from './mapEmbed';

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
