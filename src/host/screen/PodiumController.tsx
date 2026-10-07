import { useCallback, useState } from 'react';
import Button from '../../components/Button';
import { setScreenState } from '../../lib/db';
import type { ScreenMode } from '../../lib/types';
import { MODE_LABEL, nextStage, prevStage, type Stage } from './podium';
import { useScreenData } from './useScreenData';

const REVEAL_LABEL: Record<Stage, string> = {
  0: 'Reveal P3',
  1: 'Reveal P2',
  2: 'Reveal P1',
  3: 'Fully revealed',
};

/** Meant to be used from a phone while the big screen is elsewhere: same host-only actions as
 * ScreenApp's own keyboard/hint bar, as big touch targets. Low motion (R20) — this panel is an
 * internal tool, only /host/screen itself gets the high public budget. */
export default function PodiumController() {
  const { loading, error, eventId, screenState } = useScreenData();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = useCallback(
    async (p: Parameters<typeof setScreenState>[1]) => {
      if (!eventId) return;
      setBusy(true);
      setErr(null);
      try {
        await setScreenState(eventId, p);
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'The screen did not answer. Try again.');
      } finally {
        setBusy(false);
      }
    },
    [eventId],
  );

  const stage = screenState.stage as Stage;
  const mode = screenState.mode;

  if (loading) {
    return (
      <section aria-label="Big screen control" className="border-t border-line py-8">
        <div className="h-24 animate-pulse rounded-lg bg-raised" />
      </section>
    );
  }
  if (error || !eventId) {
    return (
      <section aria-label="Big screen control" className="border-t border-line py-8">
        <p className="text-muted">{error ?? 'No live event right now.'}</p>
      </section>
    );
  }

  const modeBtn = (m: ScreenMode) => (
    <Button
      key={m}
      variant={mode === m ? 'primary' : 'secondary'}
      disabled={busy}
      onClick={() => run({ mode: m })}
      className="min-w-28"
    >
      {MODE_LABEL[m]}
    </Button>
  );

  return (
    <section aria-label="Big screen control" className="border-t border-line py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-semibold">Big screen</h2>
        <a
          href="/host/screen"
          target="_blank"
          rel="noreferrer"
          className="text-sm text-muted underline hover:text-ink"
        >
          Open big screen ↗
        </a>
      </div>
      <p className="mt-2 font-mono text-sm text-muted" aria-live="polite">
        Mode: {MODE_LABEL[mode]} · Stage: {stage}/3
      </p>

      <div className="mt-4 flex flex-wrap gap-2">{(['lobby', 'standings', 'podium'] as ScreenMode[]).map(modeBtn)}</div>

      {mode === 'podium' && (
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button
            disabled={busy || stage >= 3}
            onClick={() => run({ mode: 'podium', stage: nextStage(stage) })}
            className="min-h-14 min-w-48 text-lg"
          >
            {REVEAL_LABEL[stage]}
          </Button>
          <Button variant="secondary" disabled={busy || stage <= 0} onClick={() => run({ stage: prevStage(stage) })}>
            Back
          </Button>
          <Button variant="ghost" disabled={busy || stage === 0} onClick={() => run({ stage: 0 })}>
            Reset
          </Button>
        </div>
      )}

      {err && (
        <p role="alert" className="mt-3 text-accent-text">
          {err}
        </p>
      )}
    </section>
  );
}
