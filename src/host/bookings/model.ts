import { Timestamp } from 'firebase/firestore';
import type { NewBookingEvent } from '../../lib/bookings';
import type { BookingEvent, Discount, EventCategory, DiscountKind, PriceTier, Venue } from '../../lib/types';
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
  active: boolean;
}

export interface FormState {
  id: string | null;
  raceId: string;
  category: EventCategory;
  hosted: boolean;
  description: string;
  title: string;
  dateUtc: string; // datetime-local
  capacity: string;
  salesOpen: boolean;
  policy: string;
  venueName: string;
  venueCity: string;
  venueMapUrl: string;
  venuePlaceId: string;
  venueCapacityDefault: string;
  tiers: PriceTier[];
  discounts: DiscountForm[];
}

export function blankForm(): FormState {
  return {
    id: null,
    raceId: '',
    category: 'f1',
    hosted: true,
    description: '',
    title: '',
    dateUtc: '',
    capacity: '',
    salesOpen: false,
    policy: '',
    venueName: '',
    venueCity: '',
    venueMapUrl: '',
    venuePlaceId: '',
    venueCapacityDefault: '',
    tiers: [{ id: 'tier-1', label: 'General admission', priceInr: 0, capacity: 0, seatsPerTicket: 1 }],
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
    active: d.active,
  };
}

export function eventToForm(e: BookingEvent): FormState {
  return {
    id: e.id,
    raceId: e.raceId ?? '',
    category: e.category ?? 'f1',
    // Legacy docs were only listed while sales were open, so they read as hosted.
    hosted: e.hosted ?? true,
    description: e.description ?? '',
    title: e.title,
    dateUtc: toLocalInput(new Date(e.dateUtc).getTime()),
    capacity: String(e.capacity),
    salesOpen: e.salesOpen,
    policy: e.policy ?? '',
    venueName: e.venue.name,
    venueCity: e.venue.city,
    venueMapUrl: e.venue.mapUrl ?? '',
    venuePlaceId: e.venue.place_id ?? '',
    venueCapacityDefault: e.venue.capacityDefault != null ? String(e.venue.capacityDefault) : '',
    tiers: e.tiers.map((t) => ({
      ...t,
      capacity: t.capacity ?? 0,
      seatsPerTicket: t.seatsPerTicket ?? 1,
    })),
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
  return d;
}

/** Distribute leftover seats to the tier with the fewest seats per ticket.
 * Only applies if EVERY tier has a capacity > 0. If any tier is unlimited (0/undefined),
 * returns tiers unchanged. The remainder (leftover % seatsPerTicket) stays unsold.
 * This is a pure function that does NOT mutate the input. */
export function distributeLeftoverSeats(tiers: PriceTier[], capacity: number): PriceTier[] {
  // Only apply if every tier has a capacity > 0
  if (tiers.some((t) => !t.capacity || t.capacity <= 0)) {
    return tiers;
  }

  const totalTierSeats = tiers.reduce((sum, t) => sum + (t.capacity ?? 0) * ((t.seatsPerTicket ?? 1)), 0);
  const leftover = capacity - totalTierSeats;

  if (leftover <= 0) {
    // Exact fit or overage: no leftover seats to distribute
    return tiers;
  }

  // Find tier with lowest seatsPerTicket (ties: first one wins)
  let minSeatsTier = tiers[0];
  for (const t of tiers) {
    if ((t.seatsPerTicket ?? 1) < (minSeatsTier.seatsPerTicket ?? 1)) {
      minSeatsTier = t;
    }
  }

  const seatsPerTicket = minSeatsTier.seatsPerTicket ?? 1;
  const extraTickets = Math.floor(leftover / seatsPerTicket);

  // Return new array with updated tier capacity
  return tiers.map((t) =>
    t.id === minSeatsTier.id ? { ...t, capacity: (t.capacity ?? 0) + extraTickets } : t,
  );
}

/** Builds the payload for createBookingEvent/updateBookingEvent. Caller should validate() first. */
export function formToEvent(f: FormState): NewBookingEvent {
  const venue: Venue = {
    id: 'venue-1',
    name: f.venueName.trim(),
    city: f.venueCity.trim(),
  };
  if (f.venueMapUrl.trim()) venue.mapUrl = f.venueMapUrl.trim();
  if (f.venuePlaceId.trim()) venue.place_id = f.venuePlaceId.trim();
  if (f.venueCapacityDefault.trim()) venue.capacityDefault = Number(f.venueCapacityDefault);

  const capacity = Number(f.capacity);
  const tiers = distributeLeftoverSeats(f.tiers, capacity);

  const ev: NewBookingEvent = {
    title: f.title.trim(),
    venue,
    dateUtc: new Date(fromLocalInput(f.dateUtc)).toISOString(),
    tiers,
    discounts: f.discounts.map(formToDiscount),
    capacity,
    salesOpen: f.salesOpen,
    // Always written (blank allowed) so clearing it in the form really clears it on update.
    policy: f.policy.trim(),
    category: f.category,
    hosted: f.hosted,
    // Always written (blank allowed) so clearing it in the form really clears it on update.
    description: f.description.trim(),
  };
  if (f.id) ev.id = f.id;
  // Only F1 events link to a calendar race; Kartar Cup / Club events are free-form (R50).
  if (f.category === 'f1' && f.raceId.trim()) ev.raceId = f.raceId.trim();
  return ev;
}

/** Next scheduled races (any season, soonest first) for the Details tab's "link a race" picker.
 * `extraId` (the event's currently-saved raceId, if any) is always included even if it has fallen
 * outside the default window, so editing an older event never silently blanks the selection. */
export function upcomingRaceOptions(now: Date = new Date(), limit = 5, extraId?: string): RaceInfo[] {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
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
  Record<'title' | 'description' | 'policy' | 'capacity' | 'dateUtc' | 'venueName' | 'venueCity' | 'tiers' | 'discounts', string>
>;

/** Mirrors firestore.rules `validBookingEvent` hard constraints, plus basic required-field checks. */
export function validate(f: FormState): Errors {
  const errs: Errors = {};
  if (!f.title.trim()) errs.title = 'Title is required.';
  else if (f.title.length > 120) errs.title = 'Title must be 120 characters or fewer.';

  if (f.description.trim().length > 600) errs.description = 'Keep the description to 600 characters or fewer.';

  if (f.policy.trim().length > 300) errs.policy = 'Keep the policy to 300 characters or fewer.';

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
  else if (f.discounts.some((d) => !d.code.trim()))
    errs.discounts = 'Every discount needs a code (guests enter it at checkout).';
  if (f.tiers.some((t) => t.seatsPerTicket !== undefined && (!Number.isInteger(t.seatsPerTicket) || t.seatsPerTicket < 1 || t.seatsPerTicket > 10)))
    errs.tiers = 'Seats per ticket must be a whole number from 1 to 10.';

  return errs;
}
