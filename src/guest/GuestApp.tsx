import { useState } from 'react';
import Button, { buttonCls } from '../components/Button';
import Countdown from '../components/Countdown';
import FailurePage from '../components/FailurePage';
import { PageSkeleton } from '../components/Skeleton';
import type { EventConfig } from '../lib/types';
import { useTimedOut } from '../lib/useTimedOut';
import { clearDraft, loadDraft, saveDraft, type Draft } from './draft';
import Hero from './Hero';
import { scoreOwn } from './model';
import { Eyebrow, Reveal, Split } from './parts';
import Quiz from './Quiz';
import PlayShell from './quiz/PlayShell';
import { OpensPill, ClosePill } from './quiz/RaceClock';
import { ClosedRoom, ScoredRoom, WaitingRoom } from './quiz/Rooms';
import GoogleCta, { accountName } from './SignIn';
import { useGuestSession, type GuestSession } from './useGuestSession';
import { cardBonusByUid } from '../lib/scoring';
import { isAnswered } from './quiz/logic';

const LOCKED_MSG = 'Your picks are already locked in.';
const CLOSED_MSG = 'Pit lane closed: your picks arrived after the window shut.';

/** The whole /play/<token> page: lobby, sign-in, the quiz, waiting room, closed and scored. */
export default function GuestApp({ eventId, accessToken }: { eventId: string; accessToken: string }) {
  const s = useGuestSession({ eventId, accessToken });
  const ev = s.event;
  const loading = !s.authReady || ev === undefined || (s.user !== null && s.entry === undefined);
  const stuck = useTimedOut(loading && !s.loadError);
  if (s.loadError && ev === undefined) return <FailurePage error={s.loadError} />;
  if (loading) return stuck ? <FailurePage error="Race control did not answer in time." /> : <PageSkeleton />;
  if (ev === null || ev.questions.length === 0 || !s.status) {
    return (
      <PlayShell>
        <Split
          left={
            <Reveal>
              <Eyebrow>Kartar CUP</Eyebrow>
              <h1 className="mt-3 text-h2 font-semibold text-balance">Grid not open yet</h1>
              <p className="mt-3 text-pretty text-muted">Race control has not set up this game. Check back in a few minutes.</p>
            </Reveal>
          }
        />
      </PlayShell>
    );
  }
  return <EventFlow key={ev.id} s={s} event={ev} status={s.status} />;
}

function EventFlow({
  s,
  event,
  status,
}: {
  s: GuestSession;
  event: EventConfig;
  status: NonNullable<GuestSession['status']>;
}) {
  const [draft, setDraft] = useState<Draft>(() => loadDraft(event.id));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const patch = (p: Partial<Draft>) =>
    setDraft((d) => {
      const n = { ...d, ...p };
      saveDraft(event.id, n);
      return n;
    });

  const entryAnswers = s.entry ? (s.entry.answers as unknown as Record<string, string>) : null;

  if (status === 'scored') {
    const sc = entryAnswers && s.results ? scoreOwn(event, entryAnswers, s.results.answers) : null;
    return <ScoredRoom config={event} name={s.entry?.name ?? ''} answers={entryAnswers} score={sc} cardBonus={entryAnswers ? (cardBonusByUid([{ uid: '', answers: entryAnswers }], event.questions)[''] ?? 0) : 0} />;
  }

  if (status === 'closed') return <ClosedRoom config={event} answers={entryAnswers} />;

  const submit = async () => {
    if (!event.questions.every((q) => isAnswered(q, draft.answers))) return;
    setSubmitting(true);
    setError('');
    try {
      await s.submit({ name: accountName(s.user!), answers: draft.answers });
      clearDraft(event.id);
    } catch (e) {
      const code = (e as { code?: string }).code;
      setError(code === 'already-submitted' ? LOCKED_MSG : code === 'permission-denied' ? CLOSED_MSG : 'Transmission failed. Check your signal and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const scheduled = status === 'scheduled';

  if (s.entry && entryAnswers) {
    return (
      <WaitingRoom
        config={event}
        answers={entryAnswers}
        name={s.entry.name}
        pending={s.pending}
      />
    );
  }

  const hud = scheduled ? <OpensPill opensAt={event.opensAt.toMillis()} /> : <ClosePill config={event} />;

  if (!s.user) {
    return (
      <PlayShell hud={hud}>
        <Hero config={event} status={scheduled ? 'scheduled' : 'open'}>
          <GoogleCta onGoogle={async () => void (await s.google())} />
          <p className="mt-3 text-sm text-muted">Sign in with Google so your score has your name on it.</p>
        </Hero>
      </PlayShell>
    );
  }
  // Signed in but the window has not opened: the lobby. The quiz unlocks by itself at opensAt.
  if (scheduled) {
    const first = accountName(s.user).split(/\s+/)[0];
    return (
      <PlayShell hud={hud}>
        <Hero config={event} status="scheduled" title={`You are on the grid, ${first}`}>
          <p role="status" className="mb-3 text-sm text-muted">
            You are in. The first call appears here by itself when picks open. Keep this page open.
          </p>
          <Button className="w-full md:min-h-14" disabled aria-disabled="true">
            Picks open in <Countdown target={event.opensAt.toMillis()} />
          </Button>
          <p className="mt-3 text-sm text-muted">
            Signed in as {accountName(s.user)} ·{' '}
            <button
              type="button"
              onClick={() => void s.signOut()}
              className={`${buttonCls('ghost', 'min-h-11 px-2 text-sm')} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent`}
            >
              Not you?
            </button>
          </p>
        </Hero>
      </PlayShell>
    );
  }

  return (
    <Quiz
      config={event}
      answers={draft.answers}
      step={Math.min(draft.step, event.questions.length)}
      submitting={submitting}
      error={error}
      onAnswer={(q, id) => patch({ answers: { ...draft.answers, [q]: id } })}
      onStep={(n) => patch({ step: n })}
      onSubmit={() => void submit()}
    />
  );
}
