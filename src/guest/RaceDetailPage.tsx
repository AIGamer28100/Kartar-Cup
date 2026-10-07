import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { Eyebrow, H3, PageTitle, Reveal, Shell } from './parts';
import { Magnetic, Stagger, StaggerItem, StartLightsLoader, Ticker } from '../components/motion';
import Skeleton from '../components/Skeleton';

// The telemetry card is the heaviest graphic on the page: load it only when a profile exists.
const TrackLayout = lazy(() => import('./TrackLayout'));
import { getRace } from '../config/calendar';
import { factsFor, TYRES_2026 } from '../config/tracks/raceFacts';
import { loadTrackProfile, type TrackProfile } from '../config/tracks/profiles';
import { watchBookingEvents } from '../lib/bookings';
import { usePageMeta } from '../lib/pageMeta';
import {
  fetchForecast,
  fetchSessions,
  fetchSessionWeather,
  fetchTyreUse,
  offsetSeconds,
  sessionPhase,
  summariseForecast,
  type ForecastHour,
  type RaceSession,
  type TyreUse,
  type WeatherSummary,
} from '../lib/raceData';
import type { BookingEvent } from '../lib/types';
import { ticketStatusFor } from './eventsModel';

// Results hub (session tabs + classification tables) only loads once the schedule is known.
const ResultsHub = lazy(() => import('./results/ResultsHub'));

/* R41 race detail page: everything about one race weekend - the track (length, sectors + elevation in one
 * layout), each session with its weather, completed-session results with faces, team standings and tyres.
 * Every race on the calendar gets one (we follow every race, only hosted ones have booking - R47). */

const card = 'rounded-lg border border-line p-4 md:p-5';
const h2 = H3;
const mono = 'font-mono tabular-nums';

const dateFmt = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const when = (utc: string) =>
  new Date(utc).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Pit-board style fact tile: hinges open (DRS reveal) in a staggered row; numbers tick up. */
function Fact({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <StaggerItem kind="drs" className="relative overflow-hidden rounded-lg border border-line bg-raised/50 px-3 py-3">
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[2px] opacity-70" style={{ backgroundImage: 'var(--kerb-stripes)' }} />
      <dt className="font-mono text-xs uppercase tracking-widest text-muted">{label}</dt>
      <dd className={`${mono} mt-1 text-xl font-semibold`}>{value}</dd>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </StaggerItem>
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
    <StaggerItem as="li" kind="slide" className="py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="flex items-center gap-2 font-medium">
          <span
            aria-hidden="true"
            className={`size-2 shrink-0 rounded-full ${phase === 'inprogress' ? 'bg-ok motion-safe:animate-[breathe_2.4s_ease-in-out_infinite]' : phase === 'done' ? 'bg-muted' : 'bg-line'}`}
          />
          {session.name}
        </h3>
        <p className={`${mono} text-sm text-muted`}>{when(session.startUtc)}</p>
      </div>
      <p className="mt-1 text-sm text-muted">{weatherLine}</p>
    </StaggerItem>
  );
}

/** Tyre tile: a small sidewall ring (compound band in its colour) that pops in with the row. */
function TyreChip({ label, c, tone }: { label: string; c: string; tone: string }) {
  return (
    <StaggerItem kind="scale" className="rounded-lg border border-line bg-raised/50 px-3 py-3 text-center">
      <span aria-hidden="true" className={`mx-auto mb-2 flex size-7 items-center justify-center rounded-full border-[3px] bg-base ${tone}`}>
        <span className="size-2.5 rounded-full bg-raised ring-1 ring-line" />
      </span>
      <p className="text-xs uppercase tracking-widest text-muted">{label}</p>
      <p className={`${mono} text-lg font-semibold`}>{c}</p>
    </StaggerItem>
  );
}

/** Results hub placeholder: a tab strip and a few table rows, same rhythm as the real thing. */
function ResultsSkeleton() {
  return (
    <div role="status" aria-busy="true" className="mt-4">
      <span className="sr-only">Loading results</span>
      <div className="flex gap-2 border-b border-line pb-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} variant="shimmer" className="h-8 w-20" />
        ))}
      </div>
      <Skeleton variant="shimmer" className="mt-4 h-11 w-52" />
      <div className="mt-4 grid gap-2">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} variant="shimmer" className="h-11" />
        ))}
      </div>
    </div>
  );
}

/** Same footprint as the telemetry card, so the page does not jump when it arrives. */
function TrackLayoutSkeleton({ label }: { label: string }) {
  return (
    <div role="status" className="overflow-hidden rounded-xl border border-line bg-raised/40 p-4 md:p-5">
      <div className="flex items-center justify-between gap-3">
        <Skeleton variant="shimmer" className="h-8 w-40" />
        <StartLightsLoader label={label} />
      </div>
      <Skeleton variant="shimmer" className="mt-4 aspect-[640/380] w-full" />
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} variant="shimmer" className="h-12" />
        ))}
      </div>
      <Skeleton variant="shimmer" className="mt-4 h-24" />
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
          <Link to="/events" className="kerb-link kerb-link--rest mt-4 inline-flex min-h-11 items-center text-sm text-accent-text">Back to events</Link>
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
          <Magnetic className="mt-4">
            <Link
              to={`/events/${ticket.bookingEventId}`}
              className="press inline-flex min-h-12 items-center rounded-lg bg-accent px-5 font-medium text-accent-ink transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Book our watch party
            </Link>
          </Magnetic>
        )}
        {ticket.state === 'soon' && <p className="mt-4 text-sm text-muted">Watch party - booking opening soon</p>}
      </Reveal>

      <Reveal index={1} className="mt-10">
        <h2 className={h2}>The track</h2>
        {facts ? (
          <>
            <Stagger as="dl" step={0.06} className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Fact label="Length" value={<Ticker value={facts.lengthKm} format="fixed" decimals={3} suffix=" km" />} />
              <Fact label="Laps" value={<Ticker value={facts.laps} />} />
              <Fact label="Distance" value={<Ticker value={facts.raceDistanceKm} format="fixed" decimals={1} suffix=" km" />} />
              <Fact label="Turns" value={<Ticker value={facts.turns} />} />
              <Fact label="First GP" value={String(facts.firstGp)} hint={age != null ? `${age} years old` : undefined} />
              <Fact
                label="Elevation"
                value={
                  profile ? (
                    <Ticker
                      value={Math.round((Math.max(...profile.pts.map((p) => p[2])) - Math.min(...profile.pts.map((p) => p[2]))) / 10)}
                      suffix=" m"
                    />
                  ) : (
                    '-'
                  )
                }
                hint="change around a lap"
              />
            </Stagger>
            <div className="mt-4">
              {profile === undefined && <TrackLayoutSkeleton label="Loading the track layout" />}
              {profile === null && (
                <p className={`${card} py-10 text-center text-sm text-muted`}>The track layout for this circuit is not available yet.</p>
              )}
              {profile && (
                <Suspense fallback={<TrackLayoutSkeleton label="Loading the track layout" />}>
                  <TrackLayout profile={profile} name={`${race.shortName} Grand Prix`} lengthKm={facts.lengthKm} />
                </Suspense>
              )}
            </div>
          </>
        ) : (
          <p className="mt-3 text-muted">Track details for this race will appear once the circuit data is available.</p>
        )}
      </Reveal>

      <Reveal index={2} className="mt-10">
        <h2 className={h2}>Sessions and weather</h2>
        {sessions === undefined && (
          <p role="status" className="mt-3 flex items-center gap-3 text-sm text-muted">
            <StartLightsLoader label="Loading the weekend schedule" />
            Loading the weekend schedule...
          </p>
        )}
        {sessions === null && <p className="mt-3 text-sm text-muted">The session schedule is not available right now. Try again a little later.</p>}
        {sessions && sessions.length === 0 && <p className="mt-3 text-sm text-muted">Sessions have not been published yet.</p>}
        {sessions && sessions.length > 0 && (
          <Stagger as="ul" step={0.05} className="mt-2 divide-y divide-line">
            {sessions.map((s) => (
              <SessionRow
                key={s.key}
                session={s}
                weather={sessionPhase(s) === 'done' ? weather[s.key] : undefined}
                forecastHours={forecast?.hours ?? null}
                forecastOffset={forecast?.offsetSeconds ?? (facts && sessions[0] ? offsetSeconds(sessions[0].gmtOffset) : 0)}
              />
            ))}
          </Stagger>
        )}
        <p className="mt-2 text-xs text-muted">Times shown in your local time.</p>
      </Reveal>

      <Reveal index={3} className="mt-10">
        <section aria-labelledby="results-heading">
          <Eyebrow>Classification</Eyebrow>
          <h2 id="results-heading" className={`mt-2 ${h2}`}>
            Results and standings
          </h2>
          {sessions === undefined && <ResultsSkeleton />}
          {sessions === null && (
            <p className="mt-3 text-sm text-muted">Results are not available right now. Try again a little later.</p>
          )}
          {sessions && sessions.length === 0 && <p className="mt-3 text-sm text-muted">Results appear shortly after the session ends.</p>}
          {sessions && sessions.length > 0 && (
            <Suspense fallback={<ResultsSkeleton />}>
              <ResultsHub sessions={sessions} />
            </Suspense>
          )}
        </section>
      </Reveal>

      <Reveal index={4} className="mt-10">
        <h2 className={h2}>Tyres</h2>
        {nomination ? (
          <>
            <p className="mt-2 text-sm text-muted">Pirelli compounds nominated for this weekend.</p>
            <Stagger className="mt-3 grid max-w-md grid-cols-3 gap-3" step={0.08}>
              <TyreChip label="Hard" c={nomination.hard} tone="border-ink" />
              <TyreChip label="Medium" c={nomination.medium} tone="border-warn" />
              <TyreChip label="Soft" c={nomination.soft} tone="border-accent-text" />
            </Stagger>
          </>
        ) : (
          <p className="mt-2 text-sm text-muted">Pirelli has not announced the compounds for this race yet.</p>
        )}
        {tyres && tyres.length > 0 && (
          <div className="mt-5">
            <p className="text-sm font-medium">Used in the race</p>
            <Stagger as="ul" className="mt-2 grid max-w-md gap-2">
              {tyres.map((t) => (
                <StaggerItem as="li" kind="slide" key={t.compound} className="flex items-center justify-between rounded-lg border border-line px-3 py-2 text-sm">
                  <span className="capitalize">{t.compound.toLowerCase()}</span>
                  <span className={`${mono} text-muted`}>{t.stints} stints, {t.laps} laps</span>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        )}
      </Reveal>

      <Reveal index={5} className="mt-12">
        <p className="max-w-2xl text-xs text-muted">
          Session, weather and result data: OpenF1 (CC BY-NC-SA 4.0). Forecasts: Open-Meteo. Track facts: formula1.com and
          Wikipedia. Driver photos are loaded from Formula 1's media servers. This is an independent fan site and is not
          affiliated with Formula 1, its teams or its drivers.
        </p>
        <Link to="/events" className="kerb-link kerb-link--rest mt-4 inline-flex min-h-11 items-center text-sm text-accent-text">
          Back to all events
        </Link>
      </Reveal>
    </Shell>
  );
}
