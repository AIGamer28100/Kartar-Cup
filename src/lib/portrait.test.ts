import { describe, expect, it } from 'vitest';
import { portraitUrl } from './portrait';

const U = 'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/L/LANNOR01_Lando_Norris/lannor01.png.transform/1col/image.png';

describe('portraitUrl', () => {
  it('asks the F1 CDN for the width the tile needs', () => {
    expect(portraitUrl(U, 5)).toBe(U.replace('/1col/', '/5col/'));
    expect(portraitUrl(U, 2)).toContain('.transform/2col/image.png');
  });
  it('leaves other URLs as given and null as null', () => {
    expect(portraitUrl('https://x.test/a.png', 5)).toBe('https://x.test/a.png');
    expect(portraitUrl(null, 5)).toBeNull();
    expect(portraitUrl(undefined, 5)).toBeNull();
  });
});
