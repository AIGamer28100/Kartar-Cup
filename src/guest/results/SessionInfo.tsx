import { CloudRain, Drop, FlagCheckered, Path, Thermometer, Timer, Trophy, Wind, type Icon } from '@phosphor-icons/react';
import { sessionPhase, summariseForecast, type ForecastHour, type RaceSession, type SessionPhase, type WeatherSummary } from '../../lib/raceData';

/* The card above a session's results: when it runs (in the viewer's local time), its state, and the weather
 * (recorded for a finished session, forecast for an upcoming one) plus any extra facts (winner, fastest lap). */

export type Stat = { Icon: Icon; label: string; value: string };
export interface WeatherInput {
  /** Recorded weather by session key (undefined = still loading, null = none on record). */
  weather: Record<number, WeatherSummary | null | undefined>;
  forecast: { hours: ForecastHour[]; offsetSeconds: number } | null;
  /** Circuit UTC offset in seconds, used until the forecast response supplies its own. */
  fallbackOffset: number;
}

export const WINNER_ICON = Trophy;
export const FASTEST_ICON = Timer;

function weatherStats(s: RaceSession, phase: SessionPhase, w: WeatherInput): { stats: Stat[]; note: string | null } {
  if (s.cancelled) return { stats: [], note: 'This session was cancelled.' };
  if (phase === 'done') {
    const rec = w.weather[s.key];
    if (rec === undefined) return { stats: [], note: 'Loading weather...' };
    if (!rec) return { stats: [], note: 'Weather record not available.' };
    const stats: Stat[] = [
      { Icon: Thermometer, label: 'Air', value: `${rec.airMin.toFixed(0)}-${rec.airMax.toFixed(0)} C` },
      ...(rec.trackMax == null ? [] : [{ Icon: Path, label: 'Track', value: `up to ${rec.trackMax.toFixed(0)} C` }]),
      { Icon: Drop, label: 'Humidity', value: `${rec.humidity.toFixed(0)}%` },
      { Icon: Wind, label: 'Wind', value: `up to ${rec.windMax.toFixed(0)} km/h` },
    ];
    if (rec.rain) stats.push({ Icon: CloudRain, label: 'Rain', value: 'Yes' });
    return { stats, note: null };
  }
  if (phase === 'inprogress') return { stats: [], note: 'In progress. Weather and results appear shortly after the session ends.' };
  const start = Date.parse(s.startUtc);
  if ((start - Date.now()) / 864e5 > 7) {
    const from = new Date(start - 6048e5).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    return { stats: [], note: `Forecast opens about a week before (from ${from}).` };
  }
  if (!w.forecast) return { stats: [], note: 'Loading forecast...' };
  const f = summariseForecast(w.forecast.hours, s, w.forecast.offsetSeconds || w.fallbackOffset);
  if (!f) return { stats: [], note: 'Forecast not available for this hour.' };
  return {
    stats: [
      { Icon: Thermometer, label: 'Forecast', value: `${f.tempMin.toFixed(0)}-${f.tempMax.toFixed(0)} C, ${f.label}` },
      { Icon: CloudRain, label: 'Rain chance', value: `${f.rainChance}%` },
      { Icon: Wind, label: 'Wind', value: `up to ${f.windMax.toFixed(0)} km/h` },
    ],
    note: null,
  };
}

const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'short' });
const timeFmt = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });

const BADGE = {
  upcoming: { label: 'Upcoming', cls: 'border-line text-muted' },
  inprogress: { label: 'Live', cls: 'border-ok text-ok' },
  done: { label: 'Finished', cls: 'border-line text-muted' },
  cancelled: { label: 'Cancelled', cls: 'border-accent text-accent-text' },
} as const;

export default function SessionInfo({ session, weather, extra = [] }: { session: RaceSession; weather: WeatherInput; extra?: Stat[] }) {
  const phase = sessionPhase(session);
  const badge = BADGE[session.cancelled ? 'cancelled' : phase];
  const isRace = session.name === 'Race';
  const { stats, note } = weatherStats(session, phase, weather);
  const all = [...stats, ...extra];
  const start = new Date(session.startUtc);
  const end = new Date(session.endUtc);
  return (
    <section
      aria-label={`${session.name} details`}
      className={`@container relative mt-4 overflow-hidden rounded-lg border bg-raised/50 p-4 md:p-5 ${isRace ? 'border-accent' : 'border-line'}`}
    >
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[2px] opacity-70" style={{ backgroundImage: 'var(--kerb-stripes)' }} />
      <div className="grid gap-4 @[44rem]:grid-cols-[auto_1fr] @[44rem]:gap-10">
        <div>
          <p className="flex items-center gap-2">
            {isRace && <FlagCheckered size={18} weight="regular" aria-hidden="true" className="text-accent-text" />}
            <span className={`inline-flex min-h-6 items-center rounded-full border px-2.5 font-mono text-xs uppercase tracking-widest ${badge.cls}`}>{badge.label}</span>
          </p>
          <p className="mt-3 font-mono text-sm tabular-nums text-muted">{dayFmt.format(start)}</p>
          <p className="font-mono text-2xl font-semibold tabular-nums text-ink">
            {timeFmt.format(start)}
            <span className="text-base font-normal text-muted">{` - ${timeFmt.format(end)}`}</span>
          </p>
          <p className="mt-1 text-xs text-muted">Your local time</p>
        </div>
        <div className="@container min-w-0 border-t border-line pt-4 @[44rem]:border-l @[44rem]:border-t-0 @[44rem]:pl-10 @[44rem]:pt-0">
          {all.length > 0 ? (
            <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-3 @[24rem]:grid-cols-3 @[40rem]:grid-cols-4">
              {all.map((s) => (
                <div key={s.label} className="flex min-w-0 items-start gap-2">
                  <s.Icon size={16} weight="regular" aria-hidden="true" className="mt-0.5 shrink-0 text-muted" />
                  <div className="min-w-0">
                    <dt className="font-mono text-[0.6875rem] uppercase tracking-widest text-muted">{s.label}</dt>
                    <dd className="text-sm text-ink">{s.value}</dd>
                  </div>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-sm text-muted">{note}</p>
          )}
          {all.length > 0 && note && <p className="mt-3 text-sm text-muted">{note}</p>}
        </div>
      </div>
    </section>
  );
}
