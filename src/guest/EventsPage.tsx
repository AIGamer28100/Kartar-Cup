import { createContext, useContext, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { motion, useReducedMotion } from 'framer-motion';
import { CalendarBlank, FlagCheckered, MapPin, TicketIcon, Trophy, UsersThree } from '@phosphor-icons/react';
import Divider from '../components/Divider';
import Skeleton, { Busy } from '../components/Skeleton';
import TrackMap from '../components/TrackMap';
import { ALL_RACES, type RaceInfo } from '../config/calendar';
import { trackForRace } from '../config/tracks';
import { watchActiveEventId, watchEventConfig } from '../lib/db';
import { useEventStatus } from '../lib/eventStatus';
import { watchBookingEvents } from '../lib/bookings';
import { nextSession, raceStartFor, type SessionTime } from '../lib/f1api';
import { useSchedule } from '../lib/useSchedule';
import { usePageMeta } from '../lib/pageMeta';
import type { BookingEvent, EventCategory, EventConfig } from '../lib/types';
import {
  EVENTS_TABS,
  allItems,
  categoryOf,
  defaultTab,
  eventStartMs,
  eventsInCategory,
  groupByMonth,
  parseTab,
  partitionByTime,
  previousRace,
  standaloneEvents,
  ticketStatusFor,
  timelineEntries,
  upcomingRaces,
  upcomingSeasons,
  type EventsTab,
  type TicketStatus,
} from './eventsModel';
import { quizGateVariant } from './quizGate';
import { Eyebrow, H2, PageTitle, Reveal, Shell } from './parts';

/** Weekend date range ("02–04 Oct 2026") plus the watch-party's own local/IST start (13:00 UTC
 * default unless a host has overridden it for the live event — this calendar-only view always
 * uses the default). */
type Schedule = Map<number, SessionTime[]> | null;
/** The season's real session times, provided once by EventsPage so every card reads the same data. */
const ScheduleContext = createContext<Schedule>(null);

function raceDateReadout(race: RaceInfo, schedule: Schedule): { range: string; local: string; ist: string; exact: boolean } {
  const start = new Date(`${race.weekendStart}T00:00:00Z`);
  const end = new Date(`${race.weekendEnd}T00:00:00Z`);
  const day = (d: Date) => new Intl.DateTimeFormat('en-GB', { day: '2-digit', timeZone: 'UTC' }).format(d);
  const dayMonYr = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(end);
  const range = race.weekendStart === race.weekendEnd ? dayMonYr : `${day(start)}–${dayMonYr}`;

  const { ms, exact } = raceStartFor(race, schedule);
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
  return { range, local, ist, exact };
}

/** Real circuit name via src/config/tracks where coverage exists; falls back to the calendar's
 * own `circuit` field, then a plain placeholder — never invented. */
function circuitLine(race: RaceInfo): string {
  const track = trackForRace(race.id);
  const circuit = track?.name ?? race.circuit ?? 'Circuit TBC';
  return `${circuit} · ${race.locality}, ${race.country}`;
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

function CardSkeleton({ featured = false }: { featured?: boolean }) {
  return (
    <div
      className={`grid grid-cols-[2fr_1fr] items-start gap-4 rounded-lg border border-line bg-raised p-5 ${featured ? 'sm:col-span-2 sm:grid-cols-[2fr_1fr] sm:gap-6 sm:p-6' : ''}`}
    >
      <div>
        <Skeleton className="h-3 w-32" />
        <Skeleton className="mt-3 h-6 w-full max-w-64" />
        <Skeleton className="mt-2 h-4 w-48" />
      </div>
      <Skeleton className="aspect-square w-full rounded-md" />
    </div>
  );
}

/** The circuit visual: the race's REAL validated 2D outline (TrackMap) given a CSS-only
 * perspective/tilt presentation for depth — no fabricated elevation data (R17/R32). Square box
 * (aspect-square), sized by its grid column rather than a fixed height, per the user's explicit
 * "tracks are to be contained in square boxes" request. Races with no track coverage
 * (`trackForRace` -> null) get a graceful text-only placeholder instead of a broken/blank card. */
function CircuitVisual({ race, featured }: { race: RaceInfo; featured: boolean }) {
  const track = trackForRace(race.id);
  if (!track) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-md border border-dashed border-line bg-base p-3 text-center">
        <p className="flex flex-col items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted">
          <FlagCheckered size={16} weight="regular" aria-hidden="true" />
          Circuit layout coming soon
        </p>
      </div>
    );
  }
  return (
    <div className="track-tilt-stage flex items-center justify-center overflow-hidden">
      <div className={`h-full max-h-full ${featured ? 'track-tilt-featured' : 'track-tilt'}`}>
        {/* max-h-full caps the SVG's own aspect-ratio-driven height to the stage's fixed
           height (h-auto alone lets an unusually tall/narrow circuit exceed the box) — this
           is the real fix for cards overflowing their boundaries, independent of the 3D tilt. */}
        <TrackMap
          animate
          raceId={race.id}
          title={`${race.name} circuit layout`}
          className="max-h-full"
        />
      </div>
    </div>
  );
}

/** R49: only HOSTED races/events get any watch-party wording. Not hosted -> nothing at all. */
function TicketReadout({ ticket, kind = 'f1' }: { ticket: TicketStatus; kind?: EventCategory }) {
  if (ticket.state === 'none') return null;
  if (ticket.state === 'open' && ticket.bookingEventId) {
    return (
      <Link
        to={`/events/${ticket.bookingEventId}`}
        className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-accent underline decoration-line underline-offset-4 transition after:absolute after:inset-0 after:content-[''] hover:decoration-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <TicketIcon size={18} weight="regular" aria-hidden="true" />
        Tickets available
      </Link>
    );
  }
  return (
    <p className="text-sm text-muted">{kind === 'f1' ? 'Watch party \u2014 booking opening soon' : 'Booking opening soon'}</p>
  );
}

const CATEGORY_META: Record<EventCategory, { label: string; Icon: typeof Trophy; shape: string }> = {
  f1: { label: 'F1 watch party', Icon: FlagCheckered, shape: 'rounded-full' },
  cup: { label: 'Kartar Cup', Icon: Trophy, shape: 'rounded-md' },
  club: { label: 'Kartar Club', Icon: UsersThree, shape: 'rounded-none border-dashed' },
};

/** Category label: icon + text + a distinct outline shape, so it never relies on colour alone (R50). */
function CategoryChip({ category }: { category: EventCategory }) {
  const { label, Icon, shape } = CATEGORY_META[category];
  return (
    <span
      className={`inline-flex min-h-6 items-center gap-1.5 border border-line px-2.5 font-mono text-xs uppercase tracking-widest text-ink ${shape}`}
    >
      <Icon size={14} weight="regular" aria-hidden="true" />
      {label}
    </span>
  );
}

const whenFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
const whenIstFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false });

/** A host-created event (Kartar Cup / Kartar Club / an F1 event with no calendar race). Same card
 * shell as RaceCard so the page reads as one family. */
function EventCard({ event, index }: { event: BookingEvent; index: number }) {
  const category = categoryOf(event);
  const ms = eventStartMs(event);
  const ticket: TicketStatus = event.salesOpen
    ? { available: true, bookingEventId: event.id, state: 'open' }
    : { available: false, bookingEventId: event.id, state: 'soon' };
  return (
    <Reveal
      index={index}
      className={`group relative overflow-hidden rounded-lg border border-line bg-raised p-5 transition-colors hover:border-muted ${
        ticket.available ? 'cursor-pointer hover:border-accent' : ''
      }`}
    >
      <CategoryChip category={category} />
      <h3 className="mt-3 text-pretty text-h3 font-medium text-ink">{event.title}</h3>
      <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
        <CalendarBlank size={16} weight="regular" aria-hidden="true" />
        <span>{whenFmt.format(ms)}</span>
        <span aria-hidden="true">·</span>
        <span>{whenIstFmt.format(ms)} IST</span>
      </p>
      <p className="mt-1 flex items-center gap-2 text-sm text-muted">
        <MapPin size={16} weight="regular" aria-hidden="true" />
        <span>
          {event.venue.name}, {event.venue.city}
        </span>
      </p>
      {event.description && <p className="mt-3 line-clamp-3 text-pretty text-sm text-muted">{event.description}</p>}
      <div className="mt-4">
        <TicketReadout ticket={ticket} kind={category} />
      </div>
    </Reveal>
  );
}

/** R33: for a full season a long way out (2027), a vertical timeline reads better than track
 * cards — no circuit art needed to show WHEN a race is, and a calendar gap is a real, useful
 * thing to see at a glance. Most rounds run about a week apart; a gap over a week gets a dashed
 * connector and its own "N week break" label, computed directly from each race's real raceDate,
 * never fabricated. */
function SeasonTimeline({
  entries,
  quizRaceId,
  quizVisible,
  bookingEvents,
}: {
  entries: ReturnType<typeof timelineEntries>;
  quizRaceId: string | null;
  quizVisible: boolean;
  bookingEvents: BookingEvent[];
}) {
  const schedule = useContext(ScheduleContext);
  return (
    <ol className="mt-4">
      {entries.map(({ race, gapDays, longBreak, breakLabel }, i) => {
        const { range } = raceDateReadout(race, schedule);
        const ticket = ticketStatusFor(race.id, bookingEvents);
        return (
          <li key={race.id}>
            {i > 0 && (
              <div className="flex items-center gap-3 py-1 pl-[7px]" aria-hidden={!longBreak}>
                <div
                  className={`h-8 w-px ${longBreak ? 'border-l-2 border-dashed border-line' : 'bg-line'}`}
                />
                {longBreak && (
                  <p className="font-mono text-xs uppercase tracking-widest text-muted">
                    {breakLabel} · {gapDays} days since {entries[i - 1].race.locality}
                  </p>
                )}
              </div>
            )}
            <Reveal index={i} className="relative flex gap-4">
              <span
                aria-hidden="true"
                className="mt-1.5 h-[15px] w-[15px] shrink-0 rounded-full border-2 border-accent bg-base"
              />
              <div className="min-w-0 pb-2">
                <p className="font-mono text-xs uppercase tracking-widest text-muted">
                  Round {String(race.round).padStart(2, '0')} · {range}
                </p>
                <p className="mt-1 font-medium text-ink">{race.name}</p>
                <p className="mt-1 text-sm text-muted">{circuitLine(race)}</p>
                {quizVisible && quizRaceId === race.id && (
                  <p className="mt-1 font-mono text-xs uppercase tracking-widest text-muted">
                    Predictions open at lights-out
                  </p>
                )}
                <div className="mt-2">
                  <TicketReadout ticket={ticket} />
                </div>
              </div>
            </Reveal>
          </li>
        );
      })}
    </ol>
  );
}

const dayFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
const timeFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' });

/** The real running order of the race weekend (official schedule, shown in IST). Rows rise in one
 * after another as the card scrolls into view; sessions already run are dimmed and the next one
 * gets a pulsing marker. Transform/opacity only, and plain static rows under reduced motion. */
function WeekendSchedule({ sessions }: { sessions: SessionTime[] }) {
  const reduce = useReducedMotion();
  const upcoming = nextSession(sessions, Date.now());
  return (
    <div className="border-t border-line px-5 py-5 sm:px-6">
      <p className="font-mono text-xs uppercase tracking-widest text-muted">Race weekend · IST</p>
      <ol className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {sessions.map((s, i) => {
          const done = s.startMs < Date.now() && s !== upcoming;
          const isRace = s.key === 'race';
          return (
            <motion.li
              key={s.key}
              initial={reduce ? false : { opacity: 0, y: 16 }}
              whileInView={{ opacity: done ? 0.5 : 1, y: 0 }}
              viewport={{ once: true, margin: '-40px 0px' }}
              transition={{ type: 'spring', stiffness: 220, damping: 24, delay: reduce ? 0 : i * 0.08 }}
              className={`relative rounded-lg border px-3 py-3 ${
                isRace ? 'border-accent bg-base' : 'border-line bg-base/40'
              }`}
            >
              <p className="flex items-center gap-2 text-sm font-medium text-ink">
                {s === upcoming && (
                  <span className="relative flex size-2 shrink-0" aria-hidden="true">
                    <span className="absolute inline-flex size-full rounded-full bg-accent opacity-60 motion-safe:animate-ping" />
                    <span className="relative inline-flex size-2 rounded-full bg-accent" />
                  </span>
                )}
                {s.label}
              </p>
              <p className="mt-1 font-mono text-xs tabular-nums text-muted">{dayFmt.format(s.startMs)}</p>
              <p className="font-mono text-sm tabular-nums text-ink">{timeFmt.format(s.startMs)}</p>
            </motion.li>
          );
        })}
      </ol>
    </div>
  );
}

/** One race card. `featured` renders the next-up race large with a bigger circuit visual and a
 * two-column internal layout on wider screens (mirrors HomePage's UpcomingEventsSection); all
 * other races render as the compact card used in the surrounding grid. */
function RaceCard({
  race,
  index,
  ticket,
  quizNote,
  featured = false,
  chip = false,
}: {
  race: RaceInfo;
  index: number;
  ticket: TicketStatus;
  quizNote: boolean;
  featured?: boolean;
  chip?: boolean;
}) {
  const schedule = useContext(ScheduleContext);
  const { range, local, ist, exact } = raceDateReadout(race, schedule);
  const sessions = featured ? schedule?.get(race.round) : undefined;
  return (
    <Reveal
      index={index}
      className={`group relative overflow-hidden rounded-lg border border-line bg-raised transition-colors hover:border-muted ${
        ticket.available ? 'cursor-pointer hover:border-accent' : ''
      } ${featured ? 'sm:col-span-2' : ''}`}
    >
      {/* Info on the left, square circuit box on the right, for every card size (was up/down
         for compact cards before — now consistent with the featured layout, per the user's
         explicit request). */}
      <div className={`grid grid-cols-[2fr_1fr] items-start gap-4 p-5 ${featured ? 'sm:grid-cols-[3fr_2fr] sm:gap-6 sm:p-6' : ''}`}>
        <div>
          {chip && (
            <div className="mb-3">
              <CategoryChip category="f1" />
            </div>
          )}
          <p className="font-mono text-xs uppercase tracking-widest text-muted">
            Round {String(race.round).padStart(2, '0')} · {range}
            {featured && ' · next up'}
          </p>
          <h3 className={`mt-2 text-pretty text-ink ${featured ? H2 : 'text-h3 font-medium'}`}>{race.name}</h3>
          <p className="mt-1 text-sm text-muted">{circuitLine(race)}</p>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
            <CalendarBlank size={16} weight="regular" aria-hidden="true" />
            <span>lights out {local} local</span>
            <span aria-hidden="true">·</span>
            <span>
              {ist} IST{exact ? '' : ' (est.)'}
            </span>
          </p>
          {quizNote && (
            <p className="mt-1 font-mono text-xs uppercase tracking-widest text-muted">
              Predictions open at lights-out
            </p>
          )}
          <div className="mt-4">
            <TicketReadout ticket={ticket} />
          </div>
        </div>
        <CircuitVisual race={race} featured={featured} />
      </div>
      {sessions && sessions.length > 0 && <WeekendSchedule sessions={sessions} />}
    </Reveal>
  );
}

/** Upcoming items in a grid, past ones collapsed under a native disclosure so a long history never
 * crowds the page. Empty state is honest: nothing is invented. */
function SectionedList<T>({
  items,
  startMs,
  now,
  empty,
  render,
}: {
  items: T[];
  startMs: (t: T) => number;
  now: Date;
  empty: string;
  render: (t: T, i: number) => React.ReactNode;
}) {
  const { upcoming, past } = useMemo(() => partitionByTime(items, startMs, now), [items, startMs, now]);
  if (items.length === 0) {
    return (
      <div className="mt-8 rounded-lg border border-dashed border-line p-6">
        <p className="font-medium text-ink">Nothing scheduled yet</p>
        <p className="mt-1 text-sm text-muted">{empty}</p>
      </div>
    );
  }
  return (
    <div className="mt-8">
      {upcoming.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">{upcoming.map(render)}</div>
      ) : (
        <p className="text-sm text-muted">Nothing coming up right now.</p>
      )}
      {past.length > 0 && (
        <details className="group mt-10">
          <summary className="inline-flex min-h-11 cursor-pointer items-center font-mono text-xs uppercase tracking-widest text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
            Past events ({past.length})
          </summary>
          <div className="mt-4 grid grid-cols-1 gap-6 opacity-80 sm:grid-cols-2">{past.map(render)}</div>
        </details>
      )}
    </div>
  );
}

/** Accessible segmented control: roving tabindex, arrow/Home/End keys, selection follows focus. */
function TabBar({ tab, onChange }: { tab: EventsTab; onChange: (t: EventsTab) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const last = EVENTS_TABS.length - 1;
    const next = e.key === 'ArrowRight' ? (i === last ? 0 : i + 1) : e.key === 'ArrowLeft' ? (i === 0 ? last : i - 1) : e.key === 'Home' ? 0 : e.key === 'End' ? last : -1;
    if (next < 0) return;
    e.preventDefault();
    onChange(EVENTS_TABS[next].id);
    refs.current[next]?.focus();
  };
  return (
    <div className="mt-8 flex w-full max-w-full rounded-lg border border-line p-1 sm:inline-flex sm:w-auto" role="tablist" aria-label="Event type">
      {EVENTS_TABS.map((t, i) => (
        <button
          key={t.id}
          ref={(el) => {
            refs.current[i] = el;
          }}
          id={`events-tab-${t.id}`}
          type="button"
          role="tab"
          aria-selected={tab === t.id}
          aria-controls="events-panel"
          tabIndex={tab === t.id ? 0 : -1}
          onClick={() => onChange(t.id)}
          onKeyDown={(e) => onKey(e, i)}
          className={`min-h-11 flex-1 whitespace-nowrap rounded-md px-2.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:flex-none sm:px-4 ${
            tab === t.id ? 'bg-raised text-ink' : 'text-muted hover:text-ink'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/** Public /events listing, in sections (R50): F1 (the whole calendar, one season at a time,
 * F1.com-style) | Kartar Cup | Kartar Club | All (every host event + the hosted F1 races, one list).
 * The section lives in ?tab= so it is shareable and survives back/forward. Ticket status is sourced
 * only from real BookingEvent docs (never invented, R49) - R28 (browse without auth). */
export default function EventsPage() {
  usePageMeta({ title: 'Events', description: 'Upcoming race watch parties and karting events, with tickets.' });
  const [bookingEvents, setBookingEvents] = useState<BookingEvent[] | undefined>(undefined);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const { raceId: quizRaceId, status: quizStatus } = useActiveQuizRace();
  const [params, setParams] = useSearchParams();
  const reduce = useReducedMotion();

  useEffect(
    () =>
      watchBookingEvents(setBookingEvents, (e) => {
        setLoadError(e);
        setBookingEvents([]);
      }),
    [],
  );

  const now = useMemo(() => new Date(), []);
  const seasons = useMemo(() => upcomingSeasons(now, ALL_RACES), [now]);
  const [season, setSeason] = useState<2026 | 2027 | null>(null);
  const activeSeason = season ?? seasons[0] ?? null;
  const races = useMemo(
    () => (activeSeason ? upcomingRaces(now, ALL_RACES, activeSeason) : []),
    [now, activeSeason],
  );
  const previous = useMemo(() => previousRace(now, ALL_RACES), [now]);
  const { schedule } = useSchedule(activeSeason);
  const featuredRace = races[0] ?? null;
  const groups = useMemo(() => groupByMonth(races.slice(1)), [races]);
  const entries = useMemo(() => timelineEntries(races), [races]);
  const quizVisible = quizGateVariant(quizStatus) !== 'none';
  // R33: a full season a year out reads better as a timeline (when it is, how far apart) than
  // as track-layout cards — the card grid stays for the current/imminent season (2026).
  const showTimeline = activeSeason === 2027;

  const tab: EventsTab = parseTab(params.get('tab')) ?? defaultTab(seasons.length > 0);
  const setTab = (t: EventsTab) => setParams({ tab: t }, { preventScrollReset: true });
  const events = bookingEvents ?? [];
  const cupEvents = useMemo(() => eventsInCategory(events, 'cup'), [events]);
  const clubEvents = useMemo(() => eventsInCategory(events, 'club'), [events]);
  const otherF1 = useMemo(() => standaloneEvents(events, ALL_RACES).filter((e) => categoryOf(e) === 'f1'), [events]);
  const everything = useMemo(() => allItems(ALL_RACES, events), [events]);
  const loading = bookingEvents === undefined && !loadError;

  const listSkeleton = (
    <Busy className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
      <CardSkeleton />
      <CardSkeleton />
    </Busy>
  );
  const errorNote = loadError && (
    <p className="mb-4 font-mono text-xs uppercase tracking-widest text-muted">
      Couldn&rsquo;t load event details — showing the schedule only.
    </p>
  );

  const f1Panel = (
    <>
      <p className="mt-6 max-w-[60ch] text-sm text-muted">
        Every race on the calendar is listed so you can follow along. Watch parties run only on the rounds
        marked below, and the All tab lists just those, not the rest of the calendar.
      </p>
      {seasons.length > 1 && (
        <div className="mt-6 inline-flex rounded-lg border border-line p-1" role="tablist" aria-label="Season">
          {seasons.map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={activeSeason === s}
              onClick={() => setSeason(s)}
              className={`min-h-9 rounded-md px-4 text-sm font-medium transition-colors ${
                activeSeason === s ? 'bg-raised text-ink' : 'text-muted hover:text-ink'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <Divider className="mt-8" />

      {loading ? (
        showTimeline ? (
          <Busy className="mt-8 flex flex-col gap-6">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="flex gap-4">
                <Skeleton className="h-4 w-4 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="mt-2 h-5 w-64" />
                </div>
              </div>
            ))}
          </Busy>
        ) : (
          <Busy className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
            <CardSkeleton featured />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </Busy>
        )
      ) : races.length === 0 ? (
        <Reveal className="py-10">
          <p className="text-muted">No races left on the calendar — check back for the next season.</p>
        </Reveal>
      ) : showTimeline ? (
        <div className="mt-8">
          {errorNote}
          <SeasonTimeline entries={entries} quizRaceId={quizRaceId} quizVisible={quizVisible} bookingEvents={events} />
        </div>
      ) : (
        <div className="mt-8">
          {errorNote}
          {/* F1.com-inspired featured row: Previous (small) + Next (large), 5% outer padding,
             ~2.5% gap between, previous ~15% / next ~65% of the row (the rest is breathing room,
             not a hard third card). Stacks to a single column below lg. */}
          {featuredRace && (
            <div className="flex flex-col gap-6 px-0 lg:flex-row lg:gap-[2.5%]">
              {previous && (
                <div className="lg:basis-[15%]">
                  <p className="mb-2 font-mono text-xs uppercase tracking-widest text-muted">Previous</p>
                  <RaceCard race={previous} index={0} ticket={ticketStatusFor(previous.id, events)} quizNote={false} />
                </div>
              )}
              <div className="min-w-0 lg:flex-1">
                <p className="mb-2 font-mono text-xs uppercase tracking-widest text-muted">Next</p>
                <RaceCard
                  race={featuredRace}
                  index={1}
                  ticket={ticketStatusFor(featuredRace.id, events)}
                  quizNote={quizVisible && quizRaceId === featuredRace.id}
                  featured
                />
              </div>
            </div>
          )}
          {groups.map((group, gi) => (
            <section key={group.label} aria-label={group.label} className="mt-12">
              <p className="font-mono text-xs uppercase tracking-widest text-muted">{group.label}</p>
              <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2">
                {group.races.map((race, i) => (
                  <RaceCard
                    key={race.id}
                    race={race}
                    index={gi * 3 + i}
                    ticket={ticketStatusFor(race.id, events)}
                    quizNote={quizVisible && quizRaceId === race.id}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      {!loading && otherF1.length > 0 && (
        <section aria-label="More F1 events" className="mt-12">
          <p className="font-mono text-xs uppercase tracking-widest text-muted">More F1 events</p>
          <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2">
            {otherF1.map((e, i) => (
              <EventCard key={e.id} event={e} index={i} />
            ))}
          </div>
        </section>
      )}
    </>
  );

  const eventCards = (e: BookingEvent, i: number) => <EventCard key={e.id} event={e} index={i} />;
  const categoryPanel = (items: BookingEvent[], empty: string) =>
    loading ? listSkeleton : (
      <>
        {errorNote}
        <SectionedList items={items} startMs={eventStartMs} now={now} empty={empty} render={eventCards} />
      </>
    );

  const panel =
    tab === 'f1' ? (
      f1Panel
    ) : tab === 'cup' ? (
      categoryPanel(cupEvents, 'Kartar Cup events (karting days and league nights) will show up here once they are announced.')
    ) : tab === 'club' ? (
      categoryPanel(clubEvents, 'Kartar Club meetups and watch-party extras will show up here once they are announced.')
    ) : loading ? (
      listSkeleton
    ) : (
      <>
        {errorNote}
        <SectionedList
          items={everything}
          startMs={(i) => i.startMs}
          now={now}
          empty="Hosted watch parties and events will show up here once they are announced."
          render={(item, i) =>
            item.kind === 'race' ? (
              <RaceCard key={item.key} race={item.race} index={i} ticket={item.ticket} quizNote={quizVisible && quizRaceId === item.race.id} chip />
            ) : (
              <EventCard key={item.key} event={item.event} index={i} />
            )
          }
        />
      </>
    );

  return (
    <ScheduleContext.Provider value={schedule}>
      <Shell>
        <div className="max-w-[52ch]">
          <Reveal>
            <Eyebrow>Calendar</Eyebrow>
            <h1 className={`mt-3 ${PageTitle}`}>Events</h1>
            <p className="mt-6 text-[1rem] leading-relaxed text-pretty text-muted md:mt-8 md:text-lg">
              Follow every Grand Prix, and find the watch parties and events we host. The Karter Cup doesn&rsquo;t
              run the Grand Prix itself — we host watch parties for it, with tickets going live race by race.
            </p>
          </Reveal>
        </div>

        <TabBar tab={tab} onChange={setTab} />

        <motion.div
          key={tab}
          id="events-panel"
          role="tabpanel"
          aria-labelledby={`events-tab-${tab}`}
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
        >
          {panel}
        </motion.div>
      </Shell>
    </ScheduleContext.Provider>
  );
}
