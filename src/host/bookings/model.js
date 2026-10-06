import { Timestamp } from 'firebase/firestore';
import { ALL_RACES } from '../../config/calendar';
import { raceStartFor } from '../../lib/f1api';
import { fromLocalInput, toLocalInput } from '../settings/time';
export const MAX_TIERS = 10;
export const MAX_DISCOUNTS = 20;
export function blankForm() {
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
function discountToForm(d) {
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
export function eventToForm(e) {
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
function formToDiscount(f) {
    const d = {
        id: f.id,
        label: f.label.trim(),
        kind: f.kind,
        value: Number(f.value) || 0,
        active: f.active,
    };
    if (f.code.trim())
        d.code = f.code.trim();
    if (f.minQty.trim())
        d.minQty = Number(f.minQty);
    if (f.validFromUtc.trim() && !Number.isNaN(fromLocalInput(f.validFromUtc)))
        d.validFromUtc = Timestamp.fromMillis(fromLocalInput(f.validFromUtc));
    if (f.validToUtc.trim() && !Number.isNaN(fromLocalInput(f.validToUtc)))
        d.validToUtc = Timestamp.fromMillis(fromLocalInput(f.validToUtc));
    if (f.maxRedemptions.trim())
        d.maxRedemptions = Number(f.maxRedemptions);
    return d;
}
/** Builds the payload for createBookingEvent/updateBookingEvent. Caller should validate() first. */
export function formToEvent(f) {
    const venue = {
        id: 'venue-1',
        name: f.venueName.trim(),
        city: f.venueCity.trim(),
    };
    if (f.venueMapUrl.trim())
        venue.mapUrl = f.venueMapUrl.trim();
    if (f.venuePlaceId.trim())
        venue.place_id = f.venuePlaceId.trim();
    if (f.venueCapacityDefault.trim())
        venue.capacityDefault = Number(f.venueCapacityDefault);
    const ev = {
        title: f.title.trim(),
        venue,
        dateUtc: new Date(fromLocalInput(f.dateUtc)).toISOString(),
        tiers: f.tiers,
        discounts: f.discounts.map(formToDiscount),
        capacity: Number(f.capacity),
        salesOpen: f.salesOpen,
        // Always written (blank allowed) so clearing it in the form really clears it on update.
        policy: f.policy.trim(),
        category: f.category,
        hosted: f.hosted,
        // Always written (blank allowed) so clearing it in the form really clears it on update.
        description: f.description.trim(),
    };
    if (f.id)
        ev.id = f.id;
    // Only F1 events link to a calendar race; Kartar Cup / Club events are free-form (R50).
    if (f.category === 'f1' && f.raceId.trim())
        ev.raceId = f.raceId.trim();
    return ev;
}
/** Next scheduled races (any season, soonest first) for the Details tab's "link a race" picker.
 * `extraId` (the event's currently-saved raceId, if any) is always included even if it has fallen
 * outside the default window, so editing an older event never silently blanks the selection. */
export function upcomingRaceOptions(now = new Date(), limit = 5, extraId) {
    const today = now.toISOString().slice(0, 10);
    const upcoming = ALL_RACES.filter((r) => r.status === 'scheduled' && r.raceDate >= today).slice(0, limit);
    if (extraId && !upcoming.some((r) => r.id === extraId)) {
        const extra = ALL_RACES.find((r) => r.id === extraId);
        if (extra)
            return [extra, ...upcoming];
    }
    return upcoming;
}
/** Race lights-out minus a 30-minute doors-open buffer, as a datetime-local string for the
 * dateUtc field. Uses the official session schedule when it has the round (race times differ by
 * circuit), else the flat fallback — so picking a race pulls its real time in. */
export function raceDefaultDateUtc(race, schedule) {
    return toLocalInput(raceStartFor(race, schedule).ms - 30 * 60_000);
}
/** Mirrors firestore.rules `validBookingEvent` hard constraints, plus basic required-field checks. */
export function validate(f) {
    const errs = {};
    if (!f.title.trim())
        errs.title = 'Title is required.';
    else if (f.title.length > 120)
        errs.title = 'Title must be 120 characters or fewer.';
    if (f.description.trim().length > 600)
        errs.description = 'Keep the description to 600 characters or fewer.';
    if (f.policy.trim().length > 3000)
        errs.policy = 'Keep the policy to 3000 characters or fewer.';
    const cap = Number(f.capacity);
    if (!f.capacity.trim() || !Number.isInteger(cap) || cap <= 0) {
        errs.capacity = 'Capacity must be a positive whole number.';
    }
    if (!f.dateUtc || Number.isNaN(fromLocalInput(f.dateUtc)))
        errs.dateUtc = 'Date is required.';
    if (!f.venueName.trim())
        errs.venueName = 'Venue name is required.';
    if (!f.venueCity.trim())
        errs.venueCity = 'Venue city is required.';
    if (f.tiers.length === 0)
        errs.tiers = 'At least one price tier is required.';
    else if (f.tiers.length > MAX_TIERS)
        errs.tiers = `At most ${MAX_TIERS} tiers.`;
    // Check that sum of tier capacities (with seatsPerTicket) doesn't exceed event capacity
    const totalTierSeats = f.tiers.reduce((sum, t) => {
        const tierCap = t.capacity && t.capacity > 0 ? t.capacity : Infinity;
        const seatsPerTicket = t.seatsPerTicket ?? 1;
        return sum + tierCap * seatsPerTicket;
    }, 0);
    if (Number.isFinite(totalTierSeats) && totalTierSeats < cap) {
        errs.tiers = `Sum of tier capacities (${totalTierSeats} seats) is less than event capacity (${cap}). Some seats cannot be sold.`;
    }
    if (f.discounts.length > MAX_DISCOUNTS)
        errs.discounts = `At most ${MAX_DISCOUNTS} discounts.`;
    return errs;
}
