import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Eyebrow, PageTitle, Reveal, Shell } from './parts';
import TrackLayout from './TrackLayout';
import { getRace } from '../config/calendar';
import { factsFor, TYRES_2026 } from '../config/tracks/raceFacts';
import { loadTrackProfile, type TrackProfile } from '../config/tracks/profiles';
import { watchBookingEvents } from '../lib/bookings';
import { usePageMeta } from '../lib/pageMeta';
import {
  fetchForecast,
  fetchResults,
  fetchSessions,
  fetchSessionWeather,
  fetchTyreUse,
  formatLapTime,
  offsetSeconds,
  sessionPhase,
  summariseForecast,
  teamStandings,
  type ForecastHour,
  type RaceSession,
  type ResultRow,
  type TyreUse,
  type WeatherSummary,
} from '../lib/raceData';
import type { BookingEvent } from '../lib/types';
import { ticketStatusFor } from './eventsModel';

/* R41 race detail page: everything about one race weekend - the track (length, sectors + elevation in one
 * layout), each session with its weather, completed-session results with faces, team standings and tyres.
 * Every race on the calendar gets one (we follow every race, only hosted ones have booking - R47). */

// Official F1 headshots are hot-linked from OpenF1's URLs (never downloaded or re-hosted). Flip this to
// false to fall back to number badges everywhere if F1 ever restricts the images (see decisions.md).
const SHOW_HEADSHOTS = true;

const card = 'rounded-lg border border-line p-4 md:p-5';
const h2 = 'text-xl font-semibold text-balance';
const mono = 'font-mono tabular-nums';

const dateFmt = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const when = (utc: string) =>
  new Date(utc).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function Fact({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-line px-3 py-3">
      <dt className="font-mono text-xs uppercase tracking-widest text-muted">{label}</dt>
      <dd className={`${mono} mt-1 text-xl font-semibold`}>{value}</dd>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

function Face({ row }: { row: Pick<ResultRow, 'headshotUrl' | 'number' | 'code' | 'colour'> }) {
  const [broken, setBroken] = useState(false);
  const ring = { borderColor: row.colour };
  return SHOW_HEADSHOTS && row.headshotUrl && !broken ? (
    <img
      src={row.headshotUrl}
      alt=""
      loading="lazy"
      onError={() => setBroken(true)}
      style={ring}
      className="h-10 w-10 shrink-0 rounded-full border-2 bg-raised object-cover object-top"
    />
  ) : (
    <span style={ring} className={`${mono} flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 bg-raised text-sm font-semibold`}>
      {row.number}
    </span>
  );
}

const fmtRace = (sec: number) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec - h * 3600 - m * 60;
  return `${h}:${String(m).padStart(2, '0')}:${s.toFixed(3).padStart(6, '0')}`;
};

function resultText(r: ResultRow, session: RaceSession): string {
  if (r.dsq) return 'DSQ';
  if (r.dns) return 'DNS';
  if (r.dnf) return 'DNF';
  const isRace = session.name === 'Race' || session.name === 'Sprint';
  if (isRace) return r.position === 1 && r.time ? fmtRace(r.time) : r.gap || (r.laps ? `${r.laps} laps` : '');
  return r.time ? formatLapTime(r.time) : r.gap;
}

function SessionResults({ session }: { session: RaceSession }) {
  const [rows, setRows] = useState<ResultRow[] | null>(null);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState<'drivers' | 'teams'>('drivers');

  useEffect(() => {
    let live = true;
    fetchResults(session.key)
      .then((r) => live && setRows(r))
      .catch((e: unknown) => live && setErr(e instanceof Error ? e.message : 'Could not load the results.'));
    return () => {
      live = false;
    };
  }, [session.key]);

  const teams = useMemo(() => (rows ? teamStandings(rows) : []), [rows]);
  const isRace = session.name === 'Race' || session.name === 'Sprint';

  if (err) return <p role="alert" className="mt-3 text-sm text-accent-text">{err}</p>;
  if (!rows) return <p role="status" className="mt-3 text-sm text-muted">Loading results...</p>;
  if (!rows.length) return <p className="mt-3 text-sm text-muted">No classified results are available for this session.</p>;

  const tabBtn = (id: 'drivers' | 'teams', text: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === id}
      onClick={() => setTab(id)}
      className={`min-h-11 rounded-full border px-4 text-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
        tab === id ? 'border-accent text-ink' : 'border-line text-muted hover:text-ink'
      }`}
    >
      {text}
    </button>
  );

  return (
    <div className="mt-3">
      <div role="tablist" aria-label="Result view" className="flex gap-2">
        {tabBtn('drivers', 'Drivers')}
        {tabBtn('teams', 'Teams')}
      </div>
      {tab === 'drivers' ? (
        <ol className="mt-3 divide-y divide-line">
          {rows.map((r) => (
            <li key={r.number} className="flex items-center gap-3 py-2">
              <span className={`${mono} w-7 shrink-0 text-right text-sm text-muted`}>{r.position ?? '-'}</span>
              <Face row={r} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{r.name}</span>
                <span className="flex items-center gap-2 text-xs text-muted">
                  <span aria-hidden="true" className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: r.colour }} />
                  <span className="truncate">{r.team}</span>
                </span>
              </span>
              <span className={`${mono} shrink-0 text-right text-sm`}>
                {resultText(r, session)}
                {isRace && r.points > 0 && <span className="block text-xs text-muted">{r.points} pts</span>}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <ol className="mt-3 divide-y divide-line">
          {teams.map((t, i) => (
            <li key={t.team} className="flex items-center gap-3 py-2">
              <span className={`${mono} w-7 shrink-0 text-right text-sm text-muted`}>{i + 1}</span>
              <span aria-hidden="true" className="inline-block h-8 w-1.5 shrink-0 rounded-full" style={{ background: t.colour }} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{t.team}</span>
                <span className={`${mono} text-xs text-muted`}>{t.drivers.join(' / ')}</span>
              </span>
              <span className={`${mono} shrink-0 text-sm`}>
                {isRace ? `${t.points} pts` : t.bestPosition != null ? `Best P${t.bestPosition}` : ''}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function SessionRow({
  session,
  weather,
  forecastHours,
  forecastOffset,
}: {
  session: RaceSession;
  weather: WeatherSummary | null | undefined;
  forecastHours: ForecastHour[] | null;
  forecastOffset: number;
}) {
  const phase = sessionPhase(session);
  const [open, setOpen] = useState(false);
  const daysAway = (Date.parse(session.startUtc) - Date.now()) / 86_400_000;

  let weatherLine = '';
  if (session.cancelled) weatherLine = 'Cancelled';
  else if (phase === 'done') {
    weatherLine =
      weather === undefined
        ? 'Loading weather...'
        : weather
          ? `${weather.airMin.toFixed(0)}-${weather.airMax.toFixed(0)} C air${weather.trackMax != null ? `, track up to ${weather.trackMax.toFixed(0)} C` : ''}, humidity ${weather.humidity.toFixed(0)}%, wind up to ${weather.windMax.toFixed(1)} m/s, ${weather.rain ? 'rain fell' : 'dry'}`
          : 'Weather record not available';
  } else if (phase === 'inprogress') weatherLine = 'In progress - weather and results appear shortly after the session ends';
  else if (daysAway > 7) weatherLine = `Forecast opens about a week before (from ${new Date(Date.parse(session.startUtc) - 7 * 86_400_000).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })})`;
  else if (forecastHours) {
    const f = summariseForecast(forecastHours, session, forecastOffset);
    weatherLine = f
      ? `Forecast: ${f.label}, ${f.tempMin.toFixed(0)}-${f.tempMax.toFixed(0)} C, ${f.rainChance}% chance of rain, wind up to ${f.windMax.toFixed(0)} km/h`
      : 'Forecast not available for this hour';
  } else weatherLine = 'Loading forecast...';

  return (
    <li className="py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="font-medium">{session.name}</h3>
        <p className={`${mono} text-sm text-muted`}>{when(session.startUtc)}</p>
      </div>
      <p className="mt-1 text-sm text-muted">{weatherLine}</p>
      {phase === 'done' && !session.cancelled && (
        <details className="mt-2" onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
          <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm text-accent-text underline decoration-line underline-offset-4">
            Results and standings
          </summary>
          {open && <SessionResults session={session} />}
        </details>
      )}
    </li>
  );
}

function TyreChip({ label, c, tone }: { label: string; c: string; tone: string }) {
  return (
    <div className="rounded-lg border border-line px-3 py-3 text-center">
      <span aria-hidden="true" className={`mx-auto mb-2 block h-3 w-3 rounded-full border-2 ${tone}`} />
      <p className="text-xs uppercase tracking-widest text-muted">{label}</p>
      <p className={`${mono} text-lg font-semibold`}>{c}</p>
    </div>
  );
}

export default function RaceDetailPage() {
  const { raceId = '' } = useParams();
  const race = getRace(raceId);
  const facts = factsFor(raceId);

  usePageMeta({
    title: race ? `${race.shortName} Grand Prix` : 'Race',
    description: race ? `Track, sessions, weather, results and tyres for the ${race.shortName} Grand Prix.` : undefined,
  });

  const [profile, setProfile] = useState<TrackProfile | null | undefined>(undefined);
  const [sessions, setSessions] = useState<RaceSession[] | null | undefined>(undefined);
  const [weather, setWeather] = useState<Record<number, WeatherSummary | null>>({});
  const [forecast, setForecast] = useState<{ hours: ForecastHour[]; offsetSeconds: number } | null>(null);
  const [tyres, setTyres] = useState<TyreUse[] | null>(null);
  const [bookings, setBookings] = useState<BookingEvent[]>([]);

  useEffect(() => watchBookingEvents(setBookings, () => setBookings([])), []);

  useEffect(() => {
    setProfile(undefined);
    if (!facts) return setProfile(null);
    let live = true;
    void loadTrackProfile(facts.circuitKey).then((p) => live && setProfile(p));
    return () => {
      live = false;
    };
  }, [facts]);

  useEffect(() => {
    setSessions(undefined);
    if (!facts) return setSessions(null);
    let live = true;
    fetchSessions(facts.meetingKey)
      .then((s) => live && setSessions(s))
      .catch(() => live && setSessions(null));
    return () => {
      live = false;
    };
  }, [facts]);

  // Weather for finished sessions, one at a time through the paced queue (never all at once).
  useEffect(() => {
    if (!sessions) return;
    let live = true;
    (async () => {
      for (const s of sessions) {
        if (!live) return;
        if (sessionPhase(s) !== 'done' || s.cancelled) continue;
        try {
          const w = await fetchSessionWeather(s.key);
          if (live) setWeather((m) => ({ ...m, [s.key]: w }));
        } catch {
          if (live) setWeather((m) => ({ ...m, [s.key]: null }));
        }
      }
    })();
    return () => {
      live = false;
    };
  }, [sessions]);

  // One forecast call covers every upcoming session of the weekend.
  useEffect(() => {
    if (!facts || !sessions) return;
    const upcoming = sessions.filter((s) => sessionPhase(s) === 'upcoming' && !s.cancelled && Date.parse(s.startUtc) - Date.now() < 7 * 86_400_000);
    if (!upcoming.length) return;
    let live = true;
    const start = upcoming[0].startUtc.slice(0, 10);
    const end = upcoming[upcoming.length - 1].endUtc.slice(0, 10);
    fetchForecast(facts.lat, facts.lon, start, end)
      .then((f) => live && setForecast(f))
      .catch(() => live && setForecast(null));
    return () => {
      live = false;
    };
  }, [facts, sessions]);

  // Which compounds the race actually used, once the race is over.
  useEffect(() => {
    if (!sessions) return;
    const raceSession = sessions.find((s) => s.name === 'Race' && sessionPhase(s) === 'done' && !s.cancelled);
    if (!raceSession) return;
    let live = true;
    fetchTyreUse(raceSession.key)
      .then((t) => live && setTyres(t))
      .catch(() => live && setTyres(null));
    return () => {
      live = false;
    };
  }, [sessions]);

  if (!race) {
    return (
      <Shell>
        <Reveal>
          <Eyebrow>Race</Eyebrow>
          <h1 className={`mt-3 ${PageTitle}`}>We could not find that race</h1>
          <Link to="/events" className="mt-4 inline-flex min-h-11 items-center text-accent-text underline underline-offset-4">Back to events</Link>
        </Reveal>
      </Shell>
    );
  }

  const ticket = ticketStatusFor(race.id, bookings);
  const nomination = TYRES_2026[race.id];
  const age = facts ? race.season - facts.firstGp : null;

  return (
    <Shell>
      <Reveal>
        <Eyebrow>{`Round ${race.round} - ${race.season}`}</Eyebrow>
        <h1 className={`mt-3 ${PageTitle}`}>{race.shortName} Grand Prix</h1>
        <p className="mt-2 text-muted">
          {race.locality}, {race.country} - <span className={mono}>{dateFmt(race.weekendStart)} to {dateFmt(race.weekendEnd)}</span>
        </p>
        {ticket.state === 'open' && ticket.bookingEventId && (
          <Link
            to={`/events/${ticket.bookingEventId}`}
            className="mt-4 inline-flex min-h-12 items-center rounded-lg bg-accent px-5 font-medium text-accent-ink transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Book our watch party
          </Link>
        )}
        {ticket.state === 'soon' && <p className="mt-4 text-sm text-muted">Watch party - booking opening soon</p>}
      </Reveal>

      <Reveal index={1} className="mt-10">
        <h2 className={h2}>The track</h2>
        {facts ? (
          <>
            <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Fact label="Length" value={`${facts.lengthKm.toFixed(3)} km`} />
              <Fact label="Laps" value={String(facts.laps)} />
              <Fact label="Distance" value={`${facts.raceDistanceKm.toFixed(1)} km`} />
              <Fact label="Turns" value={String(facts.turns)} />
              <Fact label="First GP" value={String(facts.firstGp)} hint={age != null ? `${age} years old` : undefined} />
              <Fact
                label="Elevation"
                value={profile ? `${Math.round((Math.max(...profile.pts.map((p) => p[2])) - Math.min(...profile.pts.map((p) => p[2]))) / 10)} m` : '-'}
                hint="change around a lap"
              />
            </dl>
            <div className={`${card} mt-4`}>
              {profile === undefined && <p role="status" className="py-10 text-center text-sm text-muted">Loading the track layout...</p>}
              {profile === null && <p className="py-10 text-center text-sm text-muted">The track layout for this circuit is not available yet.</p>}
              {profile && <TrackLayout profile={profile} name={`${race.shortName} Grand Prix`} />}
            </div>
          </>
        ) : (
          <p className="mt-3 text-muted">Track details for this race will appear once the circuit data is available.</p>
        )}
      </Reveal>

      <Reveal index={2} className="mt-10">
        <h2 className={h2}>Sessions and weather</h2>
        {sessions === undefined && <p role="status" className="mt-3 text-sm text-muted">Loading the weekend schedule...</p>}
        {sessions === null && <p className="mt-3 text-sm text-muted">The session schedule is not available right now. Try again a little later.</p>}
        {sessions && sessions.length === 0 && <p className="mt-3 text-sm text-muted">Sessions have not been published yet.</p>}
        {sessions && sessions.length > 0 && (
          <ul className="mt-2 divide-y divide-line">
            {sessions.map((s) => (
              <SessionRow
                key={s.key}
                session={s}
                weather={sessionPhase(s) === 'done' ? weather[s.key] : undefined}
                forecastHours={forecast?.hours ?? null}
                forecastOffset={forecast?.offsetSeconds ?? (facts && sessions[0] ? offsetSeconds(sessions[0].gmtOffset) : 0)}
              />
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-muted">Times shown in your local time.</p>
      </Reveal>

      <Reveal index={3} className="mt-10">
        <h2 className={h2}>Tyres</h2>
        {nomination ? (
          <>
            <p className="mt-2 text-sm text-muted">Pirelli compounds nominated for this weekend.</p>
            <div className="mt-3 grid max-w-md grid-cols-3 gap-3">
              <TyreChip label="Hard" c={nomination.hard} tone="border-ink" />
              <TyreChip label="Medium" c={nomination.medium} tone="border-[#ffc83d]" />
              <TyreChip label="Soft" c={nomination.soft} tone="border-[#ff4d61]" />
            </div>
          </>
        ) : (
          <p className="mt-2 text-sm text-muted">Pirelli has not announced the compounds for this race yet.</p>
        )}
        {tyres && tyres.length > 0 && (
          <div className="mt-5">
            <p className="text-sm font-medium">Used in the race</p>
            <ul className="mt-2 grid max-w-md gap-2">
              {tyres.map((t) => (
                <li key={t.compound} className="flex items-center justify-between rounded-lg border border-line px-3 py-2 text-sm">
                  <span className="capitalize">{t.compound.toLowerCase()}</span>
                  <span className={`${mono} text-muted`}>{t.stints} stints, {t.laps} laps</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Reveal>

      <Reveal index={4} className="mt-12">
        <p className="max-w-2xl text-xs text-muted">
          Session, weather and result data: OpenF1 (CC BY-NC-SA 4.0). Forecasts: Open-Meteo. Track facts: formula1.com and
          Wikipedia. Driver photos are loaded from Formula 1's media servers. This is an independent fan site and is not
          affiliated with Formula 1, its teams or its drivers.
        </p>
        <Link to="/events" className="mt-4 inline-flex min-h-11 items-center text-sm text-accent-text underline decoration-line underline-offset-4">
          Back to all events
        </Link>
      </Reveal>
    </Shell>
  );
}
