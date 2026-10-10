import { useEffect, useState } from 'react';
import { pickLiveLapSource, useLiveLap } from '../../lib/liveRace';
import { Flag, Lightning, Minus, Pause, Plus, ArrowCounterClockwise } from '@phosphor-icons/react';
import Button from '../../components/Button';
import Skeleton from '../../components/Skeleton';
import {
  extendCloses,
  getActiveEventId,
  setLiveLap,
  setOverride,
  setLiveQuizMode,
  setQuizDelayed,
  startQuizRace,
  watchActiveEventId,
  watchEventConfig,
  watchLiveQuizSetting,
  type LiveQuizSetting,
} from '../../lib/db';
import type { LiveQuizMode } from '../../lib/liveQuiz';
import { useNowMs } from '../../lib/eventStatus';
import QuizPrimaryButton, { runPrimary } from './QuizPrimaryButton';
import { quizControlState } from './quizControls';
import {
  quizCloseLap,
  quizCloseReason,
  quizClosesAtMs,
  quizHeldByDelay,
} from '../../lib/quizWindow';
import type { EventConfig } from '../../lib/types';
import { Section, TimeTriple, iconBtn, inputCls } from './ui';

const label = { scheduled: 'Scheduled', open: 'Open', closed: 'Closed', scored: 'Scored' } as const;
const reasonLabel = { override: 'closed by host', lap: 'closed by lap', clock: 'closed by clock' } as const;

export default function LiveControls() {
  const [activeId, setActiveId] = useState<string | null | undefined>(undefined);
  const [cfg, setCfg] = useState<EventConfig | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [lapInput, setLapInput] = useState('');
  const [autoLap, setAutoLap] = useState(false);
  const [liveSetting, setLiveSetting] = useState<LiveQuizSetting | null>(null);
  const now = useNowMs();

  useEffect(() => watchActiveEventId(setActiveId, (e) => setErr(e.message)), []);
  useEffect(() => watchLiveQuizSetting(setLiveSetting, (e) => setErr(e.message)), []);
  useEffect(() => {
    if (!activeId) {
      setCfg(activeId === null ? null : undefined);
      return;
    }
    return watchEventConfig(activeId, setCfg, (e) => setErr(e.message));
  }, [activeId]);

  async function run(fn: (id: string) => Promise<void>) {
    setBusy(true);
    setErr(null);
    try {
      const id = activeId ?? (await getActiveEventId());
      if (!id) throw new Error('No live event yet. Set one as live first.');
      await fn(id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'The pit wall did not answer. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function chooseMode(mode: LiveQuizMode) {
    if (liveSetting?.mode === mode) return;
    setBusy(true);
    setErr(null);
    try {
      await setLiveQuizMode(mode);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'The pit wall did not answer. Try again.');
    } finally {
      setBusy(false);
    }
  }

  function lightsOut() {
    if (!window.confirm('Lights out now? This starts the 30% clock from this moment and cannot be undone.')) return;
    void run(startQuizRace);
  }

  const ctl = cfg ? quizControlState(cfg, now, liveSetting?.mode ?? 'manual') : null;
  const status = ctl?.status ?? null;
  const reason = cfg ? quizCloseReason(cfg, now) : null;
  const started = !!cfg?.raceStartedAt;
  const held = cfg ? quizHeldByDelay(cfg) : false;
  const total = cfg?.totalLaps ?? null;
  const lap = cfg?.liveLap;
  const closeAtLap = cfg ? quizCloseLap(cfg) : null;
  const closesMs = cfg ? quizClosesAtMs(cfg) : null;
  const room = ctl?.extendRoomMin ?? 0;
  // Lap source: manual (free, the host types the lap) unless OpenF1's paid live feed is configured
  // (VITE_OPENF1_LIVE_URL) AND the host switches auto lap on. See worker/openf1-live/README.md.
  const liveLapSource = pickLiveLapSource('openf1-live');
  const paidLapAvailable = liveLapSource.id !== 'manual';
  useLiveLap({
    source: liveLapSource,
    enabled: paidLapAvailable && autoLap && started && !!total,
    onLap: (n) => void run((id) => setLiveLap(id, n)),
  });

  return (
    <Section title="Live controls" intro="These act on the live event immediately, no save needed.">
      <div className="mb-6 flex flex-wrap items-center gap-3" data-testid="live-quiz-mode">
        <p className="text-sm font-medium text-muted">Live quiz</p>
        <div className="flex gap-1" role="group" aria-label="How the live quiz is chosen">
          {(['manual', 'auto'] as const).map((m) => (
            <Button
              key={m}
              variant={liveSetting?.mode === m ? 'secondary' : 'ghost'}
              aria-pressed={liveSetting?.mode === m}
              disabled={busy || !liveSetting}
              onClick={() => void chooseMode(m)}
            >
              {m === 'manual' ? 'Manual' : 'Auto'}
            </Button>
          ))}
        </div>
        <p className="text-sm text-muted" data-testid="live-quiz-following">
          {!liveSetting
            ? ''
            : liveSetting.mode === 'auto'
              ? liveSetting.derivedId
                ? `Following: ${cfg && activeId === liveSetting.derivedId ? cfg.name : liveSetting.derivedId} (derived from the next watch party)`
                : 'No watch party within range'
              : "Set by hand: make a quiz live from a booking event's Quiz tab."}
        </p>
      </div>
      {cfg === undefined && activeId !== null && <Skeleton className="h-24" />}
      {(activeId === null || cfg === null) && (
        <p className="text-muted">
          {liveSetting?.mode === 'auto'
            ? 'No live quiz: no watch party with a quiz within range.'
            : "No live quiz yet. Open a booking event's Quiz tab and make it live."}
        </p>
      )}
      {cfg && (
        <>
          <div className="grid gap-6 md:grid-cols-4">
            <div>
              <p className="text-sm font-medium text-muted">Live event</p>
              <p className="mt-1 text-lg">{cfg.name}</p>
              <p className="mt-1 text-sm text-muted">
                Status <span data-testid="live-status" className="font-mono text-ink">{status ? label[status] : '--'}</span>
                {status === 'closed' && reason && <span className="font-mono text-ink"> ({reasonLabel[reason]})</span>}
                {cfg.override !== 'none' && <span className="font-mono text-ink"> (override: {cfg.override})</span>}
              </p>
            </div>
            <TimeTriple label="Quiz opens" ms={cfg.opensAt.toMillis()} testId="live-opens" />
            <TimeTriple label="Quiz closes (clock backstop)" ms={cfg.closesAt.toMillis()} testId="live-closes" />
            {started && <TimeTriple label="Actual lights out" ms={cfg.raceStartedAt!.toMillis()} testId="live-started" />}
          </div>

          <div className="mt-6 rounded-lg border border-line p-4" data-testid="quiz-clock">
            <p className="text-sm font-medium text-muted">Quiz clock</p>
            <dl className="mt-2 grid grid-cols-[9rem_1fr] gap-x-3 gap-y-1 font-mono text-sm">
              <dt className="text-muted">Race</dt>
              <dd data-testid="clock-race">{started ? 'Started' : held ? 'Delayed, quiz held open' : 'Not started'}</dd>
              <dt className="text-muted">Lap</dt>
              <dd data-testid="clock-lap">
                {lap ?? '--'} of {total ?? '--'}
              </dd>
              <dt className="text-muted">Closes at lap</dt>
              <dd data-testid="clock-close-lap">{closeAtLap ?? 'not set (clock only)'}</dd>
              <dt className="text-muted">Expected close</dt>
              <dd data-testid="clock-expected">
                {closesMs === null
                  ? 'On hold until lights out'
                  : `${new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(closesMs)} IST${closeAtLap !== null ? `, or lap ${closeAtLap} if sooner` : ''}`}
              </dd>
            </dl>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button variant="secondary" disabled={busy || started || status === 'scheduled'} onClick={lightsOut}>
                <Flag size={20} weight="regular" aria-hidden="true" /> {started ? 'Lights out recorded' : 'Lights out'}
              </Button>
              <Button
                variant="secondary"
                aria-pressed={cfg.delayed === true}
                disabled={busy || started}
                onClick={() => run((id) => setQuizDelayed(id, cfg.delayed !== true))}
              >
                <Pause size={20} weight="regular" aria-hidden="true" /> Race delayed: {cfg.delayed === true && !started ? 'on' : 'off'}
              </Button>
            </div>
            {status === 'scheduled' && !started && (
              <p className="mt-2 text-sm text-muted">
                Lights out unlocks when the quiz opens ({new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(cfg.opensAt.toMillis())} IST). To test it earlier, move the race start in the quiz Details.
              </p>
            )}

            <div className="mt-4 flex flex-wrap items-end gap-3">
              <button
                type="button"
                className={iconBtn}
                aria-label="Lap minus one"
                disabled={busy || !total || !lap}
                onClick={() => run((id) => setLiveLap(id, (lap ?? 0) - 1))}
              >
                <Minus size={20} weight="regular" aria-hidden="true" />
              </button>
              <button
                type="button"
                className={iconBtn}
                aria-label="Lap plus one"
                disabled={busy || !total || (lap ?? 0) >= (total ?? 0)}
                onClick={() => run((id) => setLiveLap(id, (lap ?? 0) + 1))}
              >
                <Plus size={20} weight="regular" aria-hidden="true" />
              </button>
              <form
                className="flex items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const n = Number(lapInput);
                  if (lapInput.trim() === '' || !Number.isInteger(n)) {
                    setErr('Enter a whole lap number.');
                    return;
                  }
                  void run((id) => setLiveLap(id, n)).then(() => setLapInput(''));
                }}
              >
                <label className="text-sm text-muted" htmlFor="live-lap">
                  Set lap
                  <input
                    id="live-lap"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={total ?? undefined}
                    className={`${inputCls} mt-1 w-24 font-mono`}
                    value={lapInput}
                    disabled={!total}
                    onChange={(e) => setLapInput(e.target.value)}
                  />
                </label>
                <Button type="submit" variant="ghost" disabled={busy || !total}>
                  Set
                </Button>
              </form>
              {!total && <p className="text-sm text-muted">Add the total laps in the quiz details to track laps.</p>}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3" data-testid="lap-source">
              <Button
                variant="ghost"
                aria-pressed={paidLapAvailable && autoLap}
                disabled={!paidLapAvailable || !started || !total}
                onClick={() => setAutoLap((v) => !v)}
              >
                Auto lap (OpenF1 live): {paidLapAvailable && autoLap ? 'on' : 'off'}
              </Button>
              <p className="text-sm text-muted">
                {paidLapAvailable
                  ? 'Follows the live lap while this page is open. You can still type over it.'
                  : 'Not configured. On the free OpenF1 tier there is no live data, so type the lap from the broadcast.'}
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            {ctl && (
              <QuizPrimaryButton
                primary={ctl.primary}
                busy={busy}
                testId="live-primary"
                onPress={() => run((id) => runPrimary(id, ctl.primary))}
              />
            )}
            {[5, 10, 15]
              .filter((m) => m <= room && status !== 'scored')
              .map((m) => (
                <Button key={m} variant="secondary" disabled={busy} onClick={() => run((id) => extendCloses(id, m, ctl?.extendUncapped ?? false))}>
                  <Plus size={20} weight="regular" aria-hidden="true" /> Extend closing +{m} min
                </Button>
              ))}
            <Button variant="ghost" disabled={busy || !ctl?.canClearOverride} onClick={() => run((id) => setOverride(id, 'none'))}>
              <ArrowCounterClockwise size={20} weight="regular" aria-hidden="true" /> Clear override
            </Button>
          </div>
          {!ctl?.canClearOverride && <p className="mt-2 text-sm text-muted">No override is set, so there is nothing to clear.</p>}
          <p className="mt-2 text-sm text-muted" data-testid="extend-room">
            {ctl?.extendUncapped
              ? 'Manual mode: Extend can go past 30% of the race, as often as you like. The lap rule only stops applying once the close passes that cap.'
              : room > 0
                ? `The close can move ${room} min later at most (30% of the race).`
                : `${ctl?.extendReason ?? 'The close is already at 30% of the race'}.`}
          </p>
        </>
      )}
      {err && (
        <p role="alert" className="mt-4 text-accent-text">
          <Lightning size={16} weight="regular" className="mr-1 inline" aria-hidden="true" />
          {err}
        </p>
      )}
    </Section>
  );
}
