import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import BackLink from '../components/BackLink';
import { buttonCls } from '../components/Button';
import { Eyebrow, H3, PageTitle, Reveal, Shell } from './parts';
import { TrackFacts } from './TrackFacts';
import { Magnetic, StartLightsLoader } from '../components/motion';
import Skeleton from '../components/Skeleton';

// The telemetry card is the heaviest graphic on the page: load it only when a profile exists.
const TrackLayout = lazy(() => import('./TrackLayout'));
import { getRace } from '../config/calendar';
import { factsFor } from '../config/tracks/raceFacts';
import { loadTrackProfile, type TrackProfile } from '../config/tracks/profiles';
import { watchBookingEvents } from '../lib/bookings';
import { usePageMeta } from '../lib/pageMeta';
import {
  fetchForecast,
  fetchSessions,
  fetchSessionWeather,
  offsetSeconds,
  sessionPhase,
  type ForecastHour,
  type RaceSession,
  type WeatherSummary,
} from '../lib/raceData';
import type { BookingEvent } from '../lib/types';
import { ticketStatusFor } from './eventsModel';

// Results hub (session tabs + classification tables) only loads once the schedule is known.
const ResultsHub = lazy(() => import('./results/ResultsHub'));

/* R41 race detail page: everything about one race weekend - every session with its time and weather, the
 * podium and results with faces and team standings, and the track (3D layout with its facts, sectors and elevation).
 * Every race on the calendar gets one (we follow every race, only hosted ones have booking - R47). */

const card = 'rounded-lg border border-line p-4 md:p-5';
const h2 = H3;
const mono = 'font-mono tabular-nums';

const dateFmt = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

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
    description: race ? `Track, sessions, weather and results for the ${race.shortName} Grand Prix.` : undefined,
  });

  const [profile, setProfile] = useState<TrackProfile | null | undefined>(undefined);
  const [sessions, setSessions] = useState<RaceSession[] | null | undefined>(undefined);
  const [weather, setWeather] = useState<Record<number, WeatherSummary | null>>({});
  const [forecast, setForecast] = useState<{ hours: ForecastHour[]; offsetSeconds: number } | null>(null);
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

  if (!race) {
    return (
      <Shell>
        <Reveal>
          <Eyebrow>Race</Eyebrow>
          <h1 className={`mt-3 ${PageTitle}`}>We could not find that race</h1>
          <BackLink to="/events" className="mt-4">Back to events</BackLink>
        </Reveal>
      </Shell>
    );
  }

  const ticket = ticketStatusFor(race.id, bookings);
  // Until the schedule arrives, guess from the race date so the layout does not jump for a finished race.
  const hasResults = sessions ? sessions.some((x) => sessionPhase(x) === 'done' && !x.cancelled) : Date.parse(`${race.raceDate}T00:00:00Z`) < Date.now();
  
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
              className={buttonCls('primary', 'press')}
            >
              Book our watch party
            </Link>
          </Magnetic>
        )}
        {ticket.state === 'soon' && <p className="mt-4 text-sm text-muted">Watch party - booking opening soon</p>}
        {ticket.state === 'cancelled' && (
          <p className="mt-4 inline-flex min-h-7 items-center rounded-md border border-accent bg-accent/10 px-2.5 font-mono text-xs font-semibold uppercase tracking-widest text-accent-text">
            Watch party cancelled
          </p>
        )}
      </Reveal>

      {/* Once any session has results: two columns from xl, the weekend (sessions, weather, podium, classification)
          on the left and the circuit (3D layout, facts, elevation, sectors) on the right. Before that there is
          nothing to classify, so the weekend's sessions come first and the circuit sits below, full width. */}
      <div className={`mt-12 grid gap-12 ${hasResults ? 'xl:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] xl:items-start xl:gap-16' : ''}`}>
      <Reveal index={1} className="min-w-0">
        <section aria-labelledby="results-heading">
          <Eyebrow>Classification</Eyebrow>
          <h2 id="results-heading" className={`mt-2 ${h2}`}>
            Results and standings
          </h2>
          <p className="mt-2 max-w-[56ch] text-sm text-muted">Every session of the weekend with its time and weather, and the results once they are in.</p>
          <div className="mt-6">
          {sessions === undefined && <ResultsSkeleton />}
          {sessions === null && (
            <p className="mt-3 text-sm text-muted">Results are not available right now. Try again a little later.</p>
          )}
          {sessions && sessions.length === 0 && <p className="mt-3 text-sm text-muted">Results appear shortly after the session ends.</p>}
          {sessions && sessions.length > 0 && (
            <Suspense fallback={<ResultsSkeleton />}>
              <ResultsHub
                sessions={sessions}
                weather={{ weather, forecast, fallbackOffset: sessions[0] ? offsetSeconds(sessions[0].gmtOffset) : 0 }}
              />
            </Suspense>
          )}
          </div>
        </section>
      </Reveal>

      <Reveal index={2} className="min-w-0">
        <Eyebrow>Circuit</Eyebrow>
        <h2 className={`mt-2 ${h2}`}>The track</h2>
        <p className="mt-2 max-w-[56ch] text-sm text-muted">The circuit in 3D with its sectors, elevation and key numbers.</p>
        {facts ? (
          <div className="mt-6">
            {profile === undefined && <TrackLayoutSkeleton label="Loading the track layout" />}
            {profile === null && (
              <>
                <p className={`${card} py-10 text-center text-sm text-muted`}>The track layout for this circuit is not available yet.</p>
                <div className="@container mt-3">
                  <TrackFacts facts={facts} season={race.season} />
                </div>
              </>
            )}
            {profile && (
              <Suspense fallback={<TrackLayoutSkeleton label="Loading the track layout" />}>
                <TrackLayout profile={profile} name={`${race.shortName} Grand Prix`} lengthKm={facts.lengthKm} facts={facts} season={race.season} />
              </Suspense>
            )}
          </div>
        ) : (
          <p className="mt-3 text-muted">Track details for this race will appear once the circuit data is available.</p>
        )}
      </Reveal>
      </div>

      <Reveal index={3} className="mt-12">
        <p className="max-w-2xl text-xs text-muted">
          Session, weather and result data: OpenF1 (CC BY-NC-SA 4.0). Forecasts: Open-Meteo. Track facts: formula1.com and
          Wikipedia. Driver photos are loaded from Formula 1's media servers. This is an independent fan site and is not
          affiliated with Formula 1, its teams or its drivers.
        </p>
        <BackLink to="/events" className="mt-4">Back to all events</BackLink>
      </Reveal>
    </Shell>
  );
}
