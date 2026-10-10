import { useEffect, useState } from 'react';
import StatusDot from '../components/StatusDot';
import { useNowMs } from '../lib/eventStatus';
import { watchLiveQuizSetting } from '../lib/db';
import type { LiveQuizMode } from '../lib/liveQuiz';
import QuizPrimaryButton, { runPrimary } from './settings/QuizPrimaryButton';
import { quizControlState } from './settings/quizControls';
import type { EventConfig } from '../lib/types';

const LABEL = { scheduled: 'Scheduled', open: 'Open', closed: 'Closed', scored: 'Scored' } as const;

/** Top of the host console: live entry count plus a quick open/close for the live event.
 * (Times, extensions and the full set of controls are in Live controls, further down the console.) */
export default function RaceControl({ config, count }: { config: EventConfig | null; count: number }) {
  const now = useNowMs();
  // Same Manual/Auto setting LiveControls reads, so both surfaces offer the same action.
  const [mode, setMode] = useState<LiveQuizMode>('manual');
  useEffect(() => watchLiveQuizSetting((st) => setMode(st.mode), () => {}), []);
  const ctl = config ? quizControlState(config, now, mode) : null;
  const status = ctl?.status ?? null;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    if (!config || !ctl) return;
    setBusy(true);
    setErr(null);
    try {
      await runPrimary(config.id, ctl.primary);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'The pit wall did not answer. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="Race control" className="border-b border-line py-8">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-sm uppercase tracking-widest text-muted">Grid entries</p>
          <p className="font-mono text-5xl tabular-nums leading-none md:text-6xl" aria-live="polite">
            {count}
          </p>
        </div>
        {config && status ? (
          <div className="flex flex-col items-start gap-3 md:items-end">
            <p className="flex items-center gap-3 text-2xl">
              <StatusDot status={status === 'open' ? 'open' : status === 'scored' ? 'scored' : 'locked'} />
              <span className="uppercase tracking-widest">{LABEL[status]}</span>
            </p>
            {ctl && <QuizPrimaryButton primary={ctl.primary} busy={busy} onPress={() => void run()} testId="race-primary" />}
          </div>
        ) : (
          <p className="text-muted">No live event yet. Set one live under Settings.</p>
        )}
      </div>
      {err && (
        <p role="alert" className="mt-4 text-accent-text">
          {err}
        </p>
      )}
    </section>
  );
}
