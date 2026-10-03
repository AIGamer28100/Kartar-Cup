import { useEffect, useMemo, useState } from 'react';
import { watchBookingEvents, watchOwnBookings } from '../lib/bookings';
import { cardBonusByUid } from '../lib/scoring';
import type { Booking, BookingEvent } from '../lib/types';

/** R46 + R15: the signed-in guest's OWN Play-card points for the race being scored. Reads only their own
 * bookings (rules allow nothing else) and the public booking-event list to match bookings to the race.
 * Any read failure just yields 0, so a missing bonus never blocks the results screen. */
export function useOwnCardBonus(uid: string | undefined, raceId: string | undefined): number {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [events, setEvents] = useState<BookingEvent[]>([]);

  useEffect(() => {
    if (!uid) {
      setBookings([]);
      return;
    }
    return watchOwnBookings(uid, setBookings, () => setBookings([]));
  }, [uid]);

  useEffect(() => {
    if (!raceId) {
      setEvents([]);
      return;
    }
    return watchBookingEvents(setEvents, () => setEvents([]));
  }, [raceId]);

  return useMemo(() => {
    if (!uid || !raceId) return 0;
    const ids = new Set(events.filter((e) => e.raceId === raceId).map((e) => e.id));
    return cardBonusByUid(bookings, ids)[uid] ?? 0;
  }, [uid, raceId, bookings, events]);
}
