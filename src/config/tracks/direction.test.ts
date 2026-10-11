import { describe, expect, it } from 'vitest';
import { TRACK_DIRECTION } from './direction';
import { TRACKS_BY_CIRCUIT } from './index';

describe('TRACK_DIRECTION', () => {
  it('covers every circuit with a cw or ccw value', () => {
    for (const id of Object.keys(TRACKS_BY_CIRCUIT)) expect(['cw', 'ccw'], id).toContain(TRACK_DIRECTION[id]);
  });
  it('knows the anticlockwise circuits', () => {
    expect(Object.entries(TRACK_DIRECTION).filter(([, d]) => d === 'ccw').map(([k]) => k).sort()).toEqual(
      ['baku', 'cota', 'interlagos', 'istanbul-park', 'jeddah', 'las-vegas', 'marina-bay', 'miami', 'yas-marina'],
    );
  });
});
