import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { CalendarBlank, TicketIcon } from '@phosphor-icons/react';
import Divider from '../components/Divider';
import Skeleton, { Busy } from '../components/Skeleton';
import { ALL_RACES, type RaceInfo } from '../config/calendar';
import { DEFAULT_RACE_START_UTC_TIME } from '../config/event';
import { watchActiveEventId, watchEventConfig } from '../lib/db';
import { useEventStatus } from '../lib/eventStatus';
import { watchBookingEvents } from '../lib/bookings';
import type { BookingEvent, EventConfig } from '../lib/types';
import { ticketStatusFor, upcomingRaces } from './eventsModel';
import { quizGateVariant } from './quizGate';
import { Eyebrow, H1, Reveal, Shell } from './parts';

/** Local (browser) + IST readout for a race's default watch-party start (13:00 UTC unless a
 * host has overridden it for the live event — the calendar-only view uses the default). */
function raceDateReadout(race: RaceInfo): { local: string; ist: string } {
  const ms = Date.parse(`${race.raceDate}T${DEFAULT_RACE_START_UTC_TIME}Z`);
  const d = new Date(ms);
  const local = new Intl.DateTimeFormat(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(d);
  const ist = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
  return { local, ist };
}

/** Light hook for the currently-live quiz event's raceId + derived status, so /events can note
 * "Predictions open at lights-out" inline without duplicating the home page's QuizBanner. */
function useActiveQuizRace(): { raceId: string | null; status: ReturnType<typeof useEventStatus> } {
  const [eventId, setEventId] = useState<string | null | undefined>(undefined);
  const [event, setEvent] = useState<EventConfig | null | undefined>(undefined);

  useEffect(() => watchActiveEventId(setEventId, () => setEventId(null)), []);
  useEffect(() => {
    if (eventId === undefined) return;
    if (eventId === null) {
      setEvent(null);
      return;
    }
    setEvent(undefined);
    return watchEventConfig(eventId, setEvent, () => setEvent(null));
  }, [eventId]);

  const status = useEventStatus(event);
  return { raceId: event?.raceId ?? null, status };
}

function RowSkeleton() {
  return (
    <div className="flex flex-col gap-3 py-6 sm:flex-row sm:items-baseline sm:justify-between">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-4 w-48" />
      </div>
      <Skeleton className="h-4 w-40" />
    </div>
  );
}

function EventRow({
  race,
  index,
  ticket,
  quizNote,
}: {
  race: RaceInfo;
  index: number;
  ticket: { available: boolean; bookingEventId: string | null };
  quizNote: boolean;
}) {
  const { local, ist } = raceDateReadout(race);
  return (
    <Reveal index={index} className="py-6 sm:flex sm:items-baseline sm:justify-between sm:gap-8">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-muted">
          Round {String(race.round).padStart(2, '0')} · watch party
        </p>
        <p className="mt-2 text-lg font-medium text-ink md:text-xl">{race.name}</p>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
          <CalendarBlank size={16} weight="regular" aria-hidden="true" />
          <span>{local} local</span>
          <span aria-hidden="true">·</span>
          <span>{ist} IST</span>
          {race.locality && (
            <>
              <span aria-hidden="true">·</span>
              <span>{race.locality}</span>
            </>
          )}
        </p>
        {quizNote && (
          <p className="mt-1 font-mono text-xs uppercase tracking-widest text-muted">
            Predictions open at lights-out
          </p>
        )}
      </div>
      <div className="mt-3 shrink-0 sm:mt-0 sm:text-right">
        {ticket.available && ticket.bookingEventId ? (
          <Link
            to={`/events/${ticket.bookingEventId}`}
            className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-accent underline decoration-line underline-offset-4 transition hover:decoration-accent"
          >
            <TicketIcon size={18} weight="regular" aria-hidden="true" />
            Tickets available
          </Link>
        ) : (
          <p className="text-sm text-muted">Watch party — booking coming soon</p>
        )}
      </div>
    </Reveal>
  );
}

/** Public /events listing: every remaining race on the calendar, in date order, with ticket
 * status sourced only from real BookingEvent docs (never invented) — R28 (browse without auth). */
export default function EventsPage() {
  const [bookingEvents, setBookingEvents] = useState<BookingEvent[] | undefined>(undefined);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const { raceId: quizRaceId, status: quizStatus } = useActiveQuizRace();

  useEffect(
    () =>
      watchBookingEvents(setBookingEvents, (e) => {
        setLoadError(e);
        setBookingEvents([]);
      }),
    [],
  );

  const races = useMemo(() => upcomingRaces(new Date(), ALL_RACES), []);
  const quizVisible = quizGateVariant(quizStatus) !== 'none';

  return (
    <Shell signIn>
      <div className="max-w-[52ch]">
        <Reveal>
          <Eyebrow>Calendar</Eyebrow>
          <h1 className={`mt-3 ${H1}`}>Events</h1>
          <p className="mt-4 text-muted md:text-lg">
            Every race left this season. The Karter Cup doesn&rsquo;t run the Grand Prix itself —
            we host watch parties for it, with tickets going live race by race.
          </p>
        </Reveal>
      </div>

      <Divider className="mt-10" />

      {bookingEvents === undefined && !loadError ? (
        <Busy>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i}>
              <RowSkeleton />
              {i < 3 && <Divider />}
            </div>
          ))}
        </Busy>
      ) : races.length === 0 ? (
        <Reveal className="py-10">
          <p className="text-muted">No races left on the calendar — check back for the next season.</p>
        </Reveal>
      ) : (
        <div>
          {loadError && (
            <p className="mb-4 font-mono text-xs uppercase tracking-widest text-muted">
              Couldn&rsquo;t load ticket status — showing the schedule only.
            </p>
          )}
          {races.map((race, i) => (
            <div key={race.id}>
              <EventRow
                race={race}
                index={i}
                ticket={ticketStatusFor(race.id, bookingEvents ?? [])}
                quizNote={quizVisible && quizRaceId === race.id}
              />
              {i < races.length - 1 && <Divider />}
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}
