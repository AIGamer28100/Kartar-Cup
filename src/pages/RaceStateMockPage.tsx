import { useState } from 'react';
import { ArrowRight, FlagCheckered, Trophy } from '@phosphor-icons/react';
import { Link } from 'react-router';
import { RaceStateBackdrop, RaceStateDisplay, type RaceState } from '../components/RaceStateDisplay';
import TrackMap from '../components/TrackMap';
import { Shell } from '../guest/parts';

const MOCK_DRIVERS = [
  { position: 1, name: 'Max Verstappen', code: 'VER', team: 'Red Bull Racing', colour: '#0600EF', headshotUrl: null, points: 25 },
  { position: 2, name: 'Lando Norris', code: 'NOR', team: 'McLaren', colour: '#FF8700', headshotUrl: null, points: 18 },
  { position: 3, name: 'Charles Leclerc', code: 'LEC', team: 'Ferrari', colour: '#EF1A2D', headshotUrl: null, points: 15 },
];

const STATES: { id: string; label: string; state: RaceState; startOffsetMs: number; resumeInMs?: number }[] = [
  { id: 'scheduled', label: 'Scheduled', state: 'scheduled', startOffsetMs: 5 * 24 * 60 * 60 * 1000 },
  { id: 'upcoming', label: 'Upcoming', state: 'upcoming', startOffsetMs: 60 * 60 * 1000 },
  { id: 'sequence', label: 'Start sequence', state: 'lights-out-sequence', startOffsetMs: 25000 },
  { id: 'countdown', label: 'Lights out', state: 'lights-out-countdown', startOffsetMs: 3000 },
  { id: 'live', label: 'In progress', state: 'in-progress', startOffsetMs: -38 * 60 * 1000 },
  { id: 'yellow', label: 'Yellow flag', state: 'yellow-flag', startOffsetMs: -44 * 60 * 1000 },
  { id: 'sector', label: 'Sector 2', state: { type: 'yellow-flag-sector', sector: 2 }, startOffsetMs: -50 * 60 * 1000 },
  { id: 'red', label: 'Red flag', state: 'red-flag', startOffsetMs: -52 * 60 * 1000 },
  { id: 'red-resume-standing', label: 'Red resume · standing', state: 'red-flag', startOffsetMs: -52 * 60 * 1000, resumeInMs: 40000 },
  { id: 'red-resume-rolling', label: 'Red resume · rolling', state: 'red-flag', startOffsetMs: -52 * 60 * 1000, resumeInMs: 40000 },
  { id: 'sc-ending', label: 'Safety car in this lap', state: 'safety-car-ending', startOffsetMs: -60 * 60 * 1000 },
  { id: 'vsc', label: 'Virtual safety car', state: 'virtual-safety-car', startOffsetMs: -60 * 60 * 1000 },
  { id: 'last-lap', label: 'Last lap', state: 'last-lap', startOffsetMs: -100 * 60 * 1000 },
  { id: 'chequered', label: 'Chequered', state: 'chequered-flag', startOffsetMs: -106 * 60 * 1000 },
  { id: 'completed', label: 'Completed', state: 'completed', startOffsetMs: -110 * 60 * 1000 },
  { id: 'cancelled', label: 'Cancelled', state: 'cancelled-by-host', startOffsetMs: -15 * 60 * 1000 },
  { id: 'unknown', label: 'Unknown', state: 'unknown', startOffsetMs: 0 },
];

const COMMUNITY_PILLARS = [
  { title: 'Kartar Cup', detail: 'Leisure karting days across Chennai and Coimbatore.' },
  { title: 'Sim racing', detail: 'A place to race, learn, and meet between track days.' },
  { title: 'Watch parties', detail: 'Grand Prix weekends shared with The Karter Club.' },
];

export default function RaceStateMockPage() {
  const [selectedId, setSelectedId] = useState(STATES[0].id);
  const [mockState, setMockState] = useState<RaceState>(STATES[0].state);
  const [previewState, setPreviewState] = useState<RaceState>(STATES[0].state);
  const [raceStartMs, setRaceStartMs] = useState(() => Date.now() + STATES[0].startOffsetMs);
  const selected = STATES.find((item) => item.id === selectedId) ?? STATES[0];
  const selectedType = typeof mockState === 'object' ? mockState.type : mockState;
  const canClearFlag = ['yellow-flag', 'yellow-flag-sector', 'red-flag', 'safety-car-ending', 'virtual-safety-car'].includes(selectedType);
  const showPodium = mockState === 'completed' || mockState === 'chequered-flag';

  return (
    <div className="relative min-h-[100dvh] overflow-hidden">
      <RaceStateBackdrop state={previewState} className="absolute inset-0 z-0" />
      <div className="relative z-10">
      <Shell>
        <div className="min-w-0">
          <section aria-label="Race state selector" className="sticky top-0 z-30 -mx-6 border-y border-line/70 bg-base/85 px-6 py-3 backdrop-blur md:-mx-10 md:px-10 lg:-mx-16 lg:px-16">
            <p className="mb-2 font-mono text-[0.65rem] uppercase tracking-widest text-muted">Preview race state</p>
            <div role="group" aria-label="Race states" className="flex flex-wrap gap-2">
              {STATES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={selected.id === item.id}
                  onClick={() => {
                    const nextState: RaceState = item.resumeInMs == null
                      ? item.state
                      : { 
                          type: 'red-flag', 
                          resumeAtMs: Date.now() + item.resumeInMs,
                          resumeProcedure: item.id === 'red-resume-rolling' ? 'rolling' : 'standing'
                        };
                    setSelectedId(item.id);
                    setMockState(nextState);
                    setPreviewState(nextState);
                    setRaceStartMs(Date.now() + item.startOffsetMs);
                  }}
                  className={`min-h-9 rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                    selected.id === item.id
                      ? 'border-ink bg-ink text-base'
                      : 'border-line text-muted hover:border-muted hover:text-ink'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            {canClearFlag && (
              <button
                type="button"
                onClick={() => {
                  setSelectedId('live');
                  setMockState('in-progress');
                  setPreviewState('in-progress');
                  setRaceStartMs(Date.now() - 38 * 60 * 1000);
                }}
                className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-md border border-line px-3 text-sm font-medium text-ink transition-colors hover:border-accent-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <FlagCheckered size={18} weight="regular" aria-hidden="true" />
                Clear flag · show green flag
              </button>
            )}
          </section>

          <section className="grid gap-10 py-12 lg:grid-cols-[44fr_56fr] lg:items-center lg:gap-14 lg:py-16">
            <div className="flex min-w-0 flex-col justify-center">
              <p className="font-mono text-xs uppercase tracking-widest text-muted">Chennai &amp; Coimbatore · motorsport community</p>
              <h1 className="mt-4 text-h1 font-bold text-ink">The Karter Cup</h1>
              <p className="mt-6 max-w-[40ch] text-lead text-pretty text-muted">
                A leisure go-karting league and F1-style motorsport community — karting days, sim racing and watch parties, run by people who actually turn up.
              </p>
              <Link
                to="/events"
                className="mt-6 inline-flex min-h-12 w-fit items-center gap-2 rounded-lg border border-line px-5 font-semibold text-accent-text transition hover:border-muted"
              >
                See the full calendar <ArrowRight size={18} weight="regular" aria-hidden="true" />
              </Link>
            </div>

            <div className="min-w-0 border-y border-line/70 py-6">
              <p className="font-mono text-xs uppercase tracking-widest text-muted">Round 17 · watch-party night</p>
              <h2 className="mt-1 text-h3 text-balance font-medium text-ink">
                Formula 1 Singapore Airlines Singapore Grand Prix 2026
              </h2>
              <p className="mt-1 text-muted">11 Oct · Singapore, Singapore</p>
              <div className="mt-6 grid items-center gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(8rem,0.65fr)]">
                <RaceStateDisplay
                  state={mockState}
                  raceStartMs={raceStartMs}
                  onDisplayStateChange={setPreviewState}
                  drivers={showPodium ? MOCK_DRIVERS : undefined}
                  showStateBackground={false}
                  greenFlagFramePlacement="viewport"
                />
                <TrackMap 
                  raceId="2026-r17-singapore" 
                  state={mockState}
                  animate 
                  className="mx-auto max-h-40 max-w-52" 
                />
              </div>
              <p className="mt-5 flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted">
                <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-info" />
                Next on track: Practice 1 · 09 Oct 14:00 IST
              </p>
            </div>
          </section>

          <section className="border-t border-line/70 py-10 md:py-14" aria-labelledby="community-heading">
            <p className="font-mono text-xs uppercase tracking-widest text-muted">More than race day</p>
            <h2 id="community-heading" className="mt-3 text-h2 font-semibold text-ink">Find your place in the paddock</h2>
            <div className="mt-7 grid gap-x-8 gap-y-6 sm:grid-cols-3">
              {COMMUNITY_PILLARS.map((pillar) => (
                <article key={pillar.title} className="border-t border-line pt-4">
                  <h3 className="font-semibold text-ink">{pillar.title}</h3>
                  <p className="mt-2 max-w-[32ch] text-sm leading-relaxed text-muted">{pillar.detail}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="border-t border-line/70 py-10 md:py-14" aria-labelledby="standings-heading">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="font-mono text-xs uppercase tracking-widest text-muted">2026 championship</p>
                <h2 id="standings-heading" className="mt-2 text-h2 font-semibold text-ink">Where the title stands</h2>
              </div>
              <Trophy size={24} weight="regular" className="text-accent-text" aria-hidden="true" />
            </div>
            <ol className="mt-6 grid list-none gap-3 p-0 sm:grid-cols-3">
              {MOCK_DRIVERS.map((driver) => (
                <li key={driver.code} className="flex items-center gap-3 border-t border-line py-3">
                  <span className="font-mono text-sm text-muted">P{driver.position}</span>
                  <span className="min-w-0 flex-1 truncate font-medium text-ink">{driver.name}</span>
                  <span className="font-mono text-sm text-muted">{driver.points} pts</span>
                </li>
              ))}
            </ol>
            <div className="mt-10 flex items-center gap-2 border-t border-line pt-5 text-xs text-muted">
              <FlagCheckered size={16} weight="regular" aria-hidden="true" />
              Independent fan community · Chennai &amp; Coimbatore
            </div>
          </section>
        </div>
      </Shell>
      </div>
    </div>
  );
}