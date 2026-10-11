import { describe, expect, it } from 'vitest';
import { blankForm, eventToForm, formToEvent, validate } from './model';

describe('R50 category fields', () => {
  const base = () => {
    const f = blankForm();
    f.title = 'Kart night';
    f.capacity = '10';
    f.dateUtc = '2026-11-01T10:00';
    f.venueName = 'V';
    f.venueCity = 'C';
    return f;
  };
  it('defaults: f1, hosted, no description', () => {
    const f = blankForm();
    expect([f.category, f.hosted, f.description]).toEqual(['f1', true, '']);
  });
  it('non-F1 categories never carry a raceId', () => {
    const f = base();
    f.category = 'cup';
    f.raceId = '2026-r17-singapore';
    expect(formToEvent(f).raceId).toBeUndefined();
    expect(formToEvent(f).category).toBe('cup');
  });
  it('f1 keeps its raceId; hosted + description are written', () => {
    const f = base();
    f.raceId = '2026-r17-singapore';
    f.description = '  hello ';
    const out = formToEvent(f);
    expect(out.raceId).toBe('2026-r17-singapore');
    expect(out.hosted).toBe(true);
    expect(out.description).toBe('hello');
  });
  it('a closed-sales hosted event is a valid form (host can create it with sales closed)', () => {
    const f = base();
    f.salesOpen = false;
    expect(validate(f)).toEqual({});
    expect(formToEvent(f)).toMatchObject({ salesOpen: false, hosted: true });
  });
  it('legacy event (no category/hosted) opens as f1 + hosted; description over 600 is flagged', () => {
    const f = eventToForm({
      id: 'x',
      title: 'T',
      venue: { id: 'v', name: 'V', city: 'C' },
      dateUtc: '2026-01-01T00:00:00Z',
      tiers: [],
      discounts: [],
      capacity: 5,
      bookedCount: 0,
      salesOpen: true,
    } as never);
    expect([f.category, f.hosted]).toEqual(['f1', true]);
    f.description = 'x'.repeat(601);
    expect(validate(f).description).toBeTruthy();
  });
});
