import { useEffect, useRef, useState } from 'react';
import Button from '../components/Button';
import Countdown from '../components/Countdown';
import Divider from '../components/Divider';
import FailurePage from '../components/FailurePage';
import Skeleton, { Busy, PageSkeleton } from '../components/Skeleton';
import StatusDot from '../components/StatusDot';
import type { EventConfig } from '../lib/types';
import { clearDraft, loadDraft, saveDraft, type Draft } from './draft';
import Hero from './Hero';
import { scoreOwn } from './model';
import Quiz from './Quiz';
import GoogleCta, { Profile, accountName } from './SignIn';
import { CloseTimer, Eyebrow, H1, PicksList, Reveal, Shell, Split, TickStrip, WhatsAppCta } from './parts';
import { useTimedOut } from '../lib/useTimedOut';
import { useGuestSession, type GuestSession } from './useGuestSession';

const CLOSED_MSG = 'Pit lane closed: your picks arrived after the window shut.';

export default function GuestApp() {
  const s = useGuestSession();
  // Lifted here so the loading skeleton (which unmounts EventFlow) cannot reset the profile step.
  const [confirmed, setConfirmed] = useState(false);
  const ev = s.event;
  const loading = !s.authReady || ev === undefined || (s.user !== null && s.entry === undefined);
  const stuck = useTimedOut(loading && !s.loadError);
  if (s.loadError && ev === undefined) return <FailurePage error={s.loadError} />;
  if (loading) return stuck ? <FailurePage error="Race control did not answer in time." /> : <PageSkeleton />;
  if (ev === null || ev.questions.length === 0 || !s.status) {
    return (
      <Shell>
        <Split left={<Reveal>
          <Eyebrow>Kartar CUP</Eyebrow>
          <h1 className={`mt-3 ${H1}`}>Grid not open yet</h1>
          <p className="mt-3 text-muted">Race control has not set up this event. Check back in a few minutes.</p>
        </Reveal>} />
      </Shell>
    );
  }
  return <EventFlow key={ev.id} s={s} event={ev} status={s.status} flow={{ confirmed, setConfirmed }} />;
}

function EventFlow({
  s,
  event,
  status,
  flow: { confirmed, setConfirmed },
}: {
  flow: { confirmed: boolean; setConfirmed: (v: boolean) => void };
  s: GuestSession;
  event: EventConfig;
  status: NonNullable<GuestSession['status']>;
}) {
  const [draft, setDraft] = useState<Draft>(() => loadDraft(event.id));
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const seeded = useRef(false);
  const wa = event.whatsappUrl;

  const patch = (p: Partial<Draft>) =>
    setDraft((d) => {
      const n = { ...d, ...p };
      saveDraft(event.id, n);
      return n;
    });

  // Seed the editable draft from a server entry once (so edits start from what was saved).
  useEffect(() => {
    if (s.entry && !seeded.current) {
      seeded.current = true;
      setDraft((d) => ({
        ...d,
        answers: { ...(s.entry!.answers as unknown as Record<string, string>) },
                phone: s.entry!.phone ?? d.phone,
      }));
    }
  }, [s.entry]);

  const entryAnswers = s.entry ? (s.entry.answers as unknown as Record<string, string>) : null;

  if (status === 'scored') {
    if (!s.entry || !entryAnswers) {
      return (
        <Shell>
          <Split left={<Reveal>
            <Eyebrow>Chequered flag</Eyebrow>
            <h1 className={`mt-3 ${H1}`}>Results are in</h1>
            <p className="mt-3 text-muted">You did not enter this round. Catch the leaderboard on the big screen.</p>
          </Reveal>} right={<Reveal index={1}>
            <WhatsAppCta url={wa} />
          </Reveal>} />
        </Shell>
      );
    }
    const sc = s.results ? scoreOwn(event, entryAnswers, s.results.answers) : null;
    return (
      <Shell>
        <Split
          left={
            <>
              <Reveal>
                <Eyebrow>Chequered flag</Eyebrow>
                <h1 className={`mt-3 ${H1}`}>{s.entry.name}, your result</h1>
              </Reveal>
              <Divider className="my-8" />
              <Reveal index={2}>
                <p className="mb-2 text-sm text-muted">Your picks</p>
                <PicksList config={event} answers={entryAnswers} />
              </Reveal>
            </>
          }
          right={
            <>
              <Reveal index={1}>
                {sc ? (
                  <>
                    <p className="font-mono text-[clamp(5rem,14vw,12rem)] font-semibold tabular-nums leading-none">
                      {sc.score}
                      <span className="text-[0.4em] text-muted"> / {event.questions.length}</span>
                    </p>
                    <div className="mt-8">
                      <TickStrip config={event} ticks={sc.ticks} />
                    </div>
                  </>
                ) : (
                  <Busy className="flex flex-col gap-3">
                    <Skeleton className="h-16 w-40" />
                    <Skeleton className="h-11 w-full" />
                  </Busy>
                )}
              </Reveal>
              <Reveal index={3} className="mt-8">
                <WhatsAppCta url={wa} />
              </Reveal>
            </>
          }
        />
      </Shell>
    );
  }

  if (status === 'closed') {
    return (
      <Shell>
        <Split
          left={
            <Reveal>
              <div className="flex items-center gap-2">
                <StatusDot status="locked" />
                <Eyebrow>{event.name}</Eyebrow>
              </div>
              <h1 className={`mt-3 ${H1}`}>Pit lane closed</h1>
              <p className="mt-3 max-w-[40ch] text-muted md:text-lg">
                {entryAnswers
                  ? 'Nobody touches the wheel now. Here is what you called.'
                  : 'You did not radio in any picks, so there is nothing to show. Watch the race and heckle accordingly.'}
              </p>
            </Reveal>
          }
          right={
            <>
              {entryAnswers && (
                <Reveal index={1}>
                  <PicksList config={event} answers={entryAnswers} />
                </Reveal>
              )}
              <Reveal index={2} className="mt-6">
                <WhatsAppCta url={wa} />
              </Reveal>
            </>
          }
        />
      </Shell>
    );
  }

  const submit = async () => {
    if (!event.questions.every((q) => !!draft.answers[q.id])) return;
    setSubmitting(true);
    setError('');
    try {
      const phone = draft.phone.trim();
      await s.submit({ name: accountName(s.user!), phone: phone || undefined, answers: draft.answers });
      clearDraft(event.id);
      setEditing(false);
    } catch (e) {
      const code = (e as { code?: string }).code;
      setError(code === 'permission-denied' ? CLOSED_MSG : 'Transmission failed. Check your signal and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const scheduled = status === 'scheduled';

  if (s.entry && entryAnswers && !editing) {
    const ok = !s.pending;
    return (
      <Shell>
        <Split
          left={
            <>
              <Reveal>
                <div className="flex items-center gap-2">
                  <StatusDot status="open" />
                  <Eyebrow>{event.name}</Eyebrow>
                </div>
                <CloseTimer closesAt={event.closesAt.toMillis()} className="mt-3" />
              </Reveal>
              <Reveal index={1} className="mt-8">
                <h1 className={H1} role="status">
                  {ok ? 'Picks locked in' : 'Transmitting to race control'}
                </h1>
                <p className="mt-3 max-w-[40ch] text-muted md:text-lg">
                  {ok
                    ? 'Copy that, ' + s.entry.name + '. Change your mind while the pit lane is open if you must.'
                    : 'Hold the line while the signal gets through.'}
                </p>
              </Reveal>
              <Reveal index={3} className="mt-8 flex flex-col items-start gap-3">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setError('');
                    patch({ step: 0 });
                    setEditing(true);
                  }}
                >
                  Edit my picks
                </Button>
                <WhatsAppCta url={wa} />
              </Reveal>
            </>
          }
          right={
            <Reveal index={2}>
              <PicksList config={event} answers={entryAnswers} />
            </Reveal>
          }
        />
      </Shell>
    );
  }

  if (!s.user) {
    return (
      <Shell signIn>
        <Hero config={event} status={scheduled ? 'scheduled' : 'open'}>
          <Reveal index={3} className="pt-2">
            <GoogleCta onGoogle={async () => void (await s.google())} />
          </Reveal>
        </Hero>
      </Shell>
    );
  }
  if (!s.entry && !confirmed) {
    return (
      <Profile
        user={s.user}
        phone={draft.phone}
        onPhone={(phone) => patch({ phone })}
        onContinue={() => setConfirmed(true)}
        onSwitch={() => void s.signOut()}
      />
    );
  }

  // Signed in but the window has not opened: quiz is gated.
  if (scheduled) {
    return (
      <Shell>
        <Hero config={event} status="scheduled">
        <Reveal index={3}>
          <p role="status" className="mb-3 text-sm text-muted">
            You are on the grid, {accountName(s.user)}. The quiz unlocks by itself when picks open.
          </p>
          <Button className="w-full" disabled aria-disabled="true">
            Picks open in <Countdown target={event.opensAt.toMillis()} />
          </Button>
        </Reveal>
        </Hero>
      </Shell>
    );
  }

  return (
    <Quiz
      config={event}
      answers={draft.answers}
      step={Math.min(draft.step, event.questions.length)}
      submitting={submitting}
      error={error}
      isEdit={!!s.entry}
      onAnswer={(q, id) => patch({ answers: { ...draft.answers, [q]: id } })}
      onStep={(n) => patch({ step: n })}
      onSubmit={() => void submit()}
      onCancel={s.entry ? () => setEditing(false) : undefined}
    />
  );
}
