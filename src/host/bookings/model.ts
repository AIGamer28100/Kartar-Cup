import { Timestamp } from 'firebase/firestore';
import type { NewBookingEvent } from '../../lib/bookings';
import type { BookingEvent, Discount, DiscountKind, PriceTier, Venue } from '../../lib/types';
import { ALL_RACES, type RaceInfo } from '../../config/calendar';
import { raceStartFor, type SessionTime } from '../../lib/f1api';
import { fromLocalInput, toLocalInput } from '../settings/time';

export const MAX_TIERS = 10;
export const MAX_DISCOUNTS = 20;

export interface DiscountForm {
  id: string;
  code: string;
  label: string;
  kind: DiscountKind;
  value: string;
  minQty: string;
  validFromUtc: string; // datetime-local
  validToUtc: string; // datetime-local
  maxRedemptions: string;
  active: boolean;
}

export interface FormState {
  id: string | null;
  raceId: string;
  title: string;
  dateUtc: string; // datetime-local
  capacity: string;
  salesOpen: boolean;
  venueName: string;
  venueCity: string;
  venueMapUrl: string;
  venueCapacityDefault: string;
  tiers: PriceTier[];
  discounts: DiscountForm[];
}

export function blankForm(): FormState {
  return {
    id: null,
    raceId: '',
    title: '',
    dateUtc: '',
    capacity: '',
    salesOpen: false,
    venueName: '',
    venueCity: '',
    venueMapUrl: '',
    venueCapacityDefault: '',
    tiers: [{ id: 'tier-1', label: 'General admission', priceInr: 0 }],
    discounts: [],
  };
}

function discountToForm(d: Discount): DiscountForm {
  return {
    id: d.id,
    code: d.code ?? '',
    label: d.label,
    kind: d.kind,
    value: String(d.value),
    minQty: d.minQty != null ? String(d.minQty) : '',
    validFromUtc: d.validFromUtc ? toLocalInput(d.validFromUtc.toMillis()) : '',
    validToUtc: d.validToUtc ? toLocalInput(d.validToUtc.toMillis()) : '',
    maxRedemptions: d.maxRedemptions != null ? String(d.maxRedemptions) : '',
    active: d.active,
  };
}

export function eventToForm(e: BookingEvent): FormState {
  return {
    id: e.id,
    raceId: e.raceId ?? '',
    title: e.title,
    dateUtc: toLocalInput(new Date(e.dateUtc).getTime()),
    capacity: String(e.capacity),
    salesOpen: e.salesOpen,
    venueName: e.venue.name,
    venueCity: e.venue.city,
    venueMapUrl: e.venue.mapUrl ?? '',
    venueCapacityDefault: e.venue.capacityDefault != null ? String(e.venue.capacityDefault) : '',
    tiers: e.tiers,
    discounts: e.discounts.map(discountToForm),
  };
}

function formToDiscount(f: DiscountForm): Discount {
  const d: Discount = {
    id: f.id,
    label: f.label.trim(),
    kind: f.kind,
    value: Number(f.value) || 0,
    active: f.active,
  };
  if (f.code.trim()) d.code = f.code.trim();
  if (f.minQty.trim()) d.minQty = Number(f.minQty);
  if (f.validFromUtc.trim() && !Number.isNaN(fromLocalInput(f.validFromUtc)))
    d.validFromUtc = Timestamp.fromMillis(fromLocalInput(f.validFromUtc));
  if (f.validToUtc.trim() && !Number.isNaN(fromLocalInput(f.validToUtc)))
    d.validToUtc = Timestamp.fromMillis(fromLocalInput(f.validToUtc));
  if (f.maxRedemptions.trim()) d.maxRedemptions = Number(f.maxRedemptions);
  return d;
}

/** Builds the payload for createBookingEvent/updateBookingEvent. Caller should validate() first. */
export function formToEvent(f: FormState): NewBookingEvent {
  const venue: Venue = {
    id: 'venue-1',
    name: f.venueName.trim(),
    city: f.venueCity.trim(),
  };
  if (f.venueMapUrl.trim()) venue.mapUrl = f.venueMapUrl.trim();
  if (f.venueCapacityDefault.trim()) venue.capacityDefault = Number(f.venueCapacityDefault);

  const ev: NewBookingEvent = {
    title: f.title.trim(),
    venue,
    dateUtc: new Date(fromLocalInput(f.dateUtc)).toISOString(),
    tiers: f.tiers,
    discounts: f.discounts.map(formToDiscount),
    capacity: Number(f.capacity),
    salesOpen: f.salesOpen,
  };
  if (f.id) ev.id = f.id;
  if (f.raceId.trim()) ev.raceId = f.raceId.trim();
  return ev;
}

/** Next scheduled races (any season, soonest first) for the Details tab's "link a race" picker.
 * `extraId` (the event's currently-saved raceId, if any) is always included even if it has fallen
 * outside the default window, so editing an older event never silently blanks the selection. */
export function upcomingRaceOptions(now: Date = new Date(), limit = 5, extraId?: string): RaceInfo[] {
  const today = now.toISOString().slice(0, 10);
  const upcoming = ALL_RACES.filter((r) => r.status === 'scheduled' && r.raceDate >= today).slice(0, limit);
  if (extraId && !upcoming.some((r) => r.id === extraId)) {
    const extra = ALL_RACES.find((r) => r.id === extraId);
    if (extra) return [extra, ...upcoming];
  }
  return upcoming;
}

/** Race lights-out minus a 30-minute doors-open buffer, as a datetime-local string for the
 * dateUtc field. Uses the official session schedule when it has the round (race times differ by
 * circuit), else the flat fallback — so picking a race pulls its real time in. */
export function raceDefaultDateUtc(race: RaceInfo, schedule?: Map<number, SessionTime[]> | null): string {
  return toLocalInput(raceStartFor(race, schedule).ms - 30 * 60_000);
}

export type Errors = Partial<
  Record<'title' | 'capacity' | 'dateUtc' | 'venueName' | 'venueCity' | 'tiers' | 'discounts', string>
>;

/** Mirrors firestore.rules `validBookingEvent` hard constraints, plus basic required-field checks. */
export function validate(f: FormState): Errors {
  const errs: Errors = {};
  if (!f.title.trim()) errs.title = 'Title is required.';
  else if (f.title.length > 120) errs.title = 'Title must be 120 characters or fewer.';

  const cap = Number(f.capacity);
  if (!f.capacity.trim() || !Number.isInteger(cap) || cap <= 0) {
    errs.capacity = 'Capacity must be a positive whole number.';
  }

  if (!f.dateUtc || Number.isNaN(fromLocalInput(f.dateUtc))) errs.dateUtc = 'Date is required.';

  if (!f.venueName.trim()) errs.venueName = 'Venue name is required.';
  if (!f.venueCity.trim()) errs.venueCity = 'Venue city is required.';

  if (f.tiers.length === 0) errs.tiers = 'At least one price tier is required.';
  else if (f.tiers.length > MAX_TIERS) errs.tiers = `At most ${MAX_TIERS} tiers.`;

  if (f.discounts.length > MAX_DISCOUNTS) errs.discounts = `At most ${MAX_DISCOUNTS} discounts.`;

  return errs;
}
