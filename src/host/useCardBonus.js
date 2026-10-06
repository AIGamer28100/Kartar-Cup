import { useEffect, useMemo, useState } from 'react';
import { watchAllBookingEvents, watchAllBookings } from '../lib/bookings';
import { cardBonusByUid } from '../lib/scoring';
/** R46: Play-card points by guest uid for the race being scored. Host-only data (all bookings), so a
 * failed read just means "no bonus", never an error screen. A race can have more than one booking
 * event (e.g. two venues), so every booking event with this raceId counts. */
export function useCardBonus(raceId) {
    const [events, setEvents] = useState([]);
    const [byEvent, setByEvent] = useState({});
    useEffect(() => {
        if (!raceId) {
            setEvents([]);
            return;
        }
        return watchAllBookingEvents((all) => setEvents(all.filter((e) => e.raceId === raceId)), () => setEvents([]));
    }, [raceId]);
    const idKey = events.map((e) => e.id).sort().join(',');
    useEffect(() => {
        if (!idKey) {
            setByEvent({});
            return;
        }
        const unsubs = idKey.split(',').map((id) => watchAllBookings(id, (b) => setByEvent((m) => ({ ...m, [id]: b })), () => setByEvent((m) => ({ ...m, [id]: [] }))));
        return () => unsubs.forEach((u) => u());
    }, [idKey]);
    return useMemo(() => cardBonusByUid(Object.values(byEvent).flat(), new Set(idKey ? idKey.split(',') : [])), [byEvent, idKey]);
}
