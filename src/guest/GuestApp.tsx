import { useEffect, useRef, useState } from 'react';
import { ArrowRight } from '@phosphor-icons/react';
import Button from '../components/Button';
import Countdown from '../components/Countdown';
import Divider from '../components/Divider';
import Skeleton from '../components/Skeleton';
import StatusDot from '../components/StatusDot';
import type { EventConfig } from '../lib/types';
import { clearDraft, loadDraft, saveDraft, type Draft } from './draft';
import Hero from './Hero';
import { scoreOwn } from './model';
import Quiz from './Quiz';
import SignIn, { Profile, accountName } from './SignIn';
import { CloseTimer, Eyebrow, PicksList, Reveal, Shell, TickStrip, WhatsAppCta } from './parts';
import { useGuestSession, type GuestSession } from './useGuestSession';

const CLOSED_MSG = 'Pit lane closed: your picks arrived after the window shut.';

export default function GuestApp() {
  const s = useGuestSession();
  // Lifted here so the loading skeleton (which unmounts EventFlow) cannot reset the sign-in flow.
  const [started, setStarted] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const ev = s.event;
  if (!s.authReady || ev === undefined || (s.user !== null && s.entry === undefined)) return <LoadingSkeleton />;
  if (ev === null || ev.questions.length === 0 || !s.status) {
    return (
      <Shell>
        <Reveal>
          <Eyebrow>Kartar CUP</Eyebrow>
          <h1 className="mt-3 text-4xl font-semibold leading-none tracking-tight">Grid not open yet</h1>
          <p className="mt-3 text-muted">Race control has not set up this event. Check back in a few minutes.</p>
        </Reveal>
      </Shell>
    );
  }
  return <EventFlow key={ev.id} s={s} event={ev} status={s.status} flow={{ started, setStarted, confirmed, setConfirmed }} />;
}

function EventFlow({
  s,
  event,
  status,
  flow: { started, setStarted, confirmed, setConfirmed },
}: {
  flow: { started: boolean; setStarted: (v: boolean) => void; confirmed: boolean; setConfirmed: (v: boolean) => void };
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
          <Reveal>
            <Eyebrow>Chequered flag</Eyebrow>
            <h1 className="mt-3 text-4xl font-semibold leading-none tracking-tight">Results are in</h1>
            <p className="mt-3 text-muted">You did not enter this round. Catch the leaderboard on the big screen.</p>
          </Reveal>
          <Reveal index={1} className="mt-6">
            <WhatsAppCta url={wa} />
          </Reveal>
        </Shell>
      );
    }
    const sc = s.results ? scoreOwn(event, entryAnswers, s.results.answers) : null;
    return (
      <Shell>
        <Reveal>
          <Eyebrow>Chequered flag</Eyebrow>
          <h1 className="mt-3 text-4xl font-semibold leading-none tracking-tight">{s.entry.name}, your result</h1>
        </Reveal>
        <Reveal index={1} className="mt-8">
          {sc ? (
            <>
              <p className="font-mono text-7xl font-semibold tabular-nums leading-none">
                {sc.score}
                <span className="text-3xl text-muted"> / {event.questions.length}</span>
              </p>
              <div className="mt-6">
                <TickStrip config={event} ticks={sc.ticks} />
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-3" aria-busy="true">
              <Skeleton className="h-16 w-40" />
              <Skeleton className="h-11 w-full" />
            </div>
          )}
        </Reveal>
        <Divider className="my-8" />
        <Reveal index={2}>
          <p className="mb-2 text-sm text-muted">Your picks</p>
          <PicksList config={event} answers={entryAnswers} />
        </Reveal>
        <Reveal index={3} className="mt-6">
          <WhatsAppCta url={wa} />
        </Reveal>
      </Shell>
    );
  }

  if (status === 'closed') {
    return (
      <Shell>
        <Reveal>
          <div className="flex items-center gap-2">
            <StatusDot status="locked" />
            <Eyebrow>{event.name}</Eyebrow>
          </div>
          <h1 className="mt-3 text-4xl font-semibold leading-none tracking-tight">Pit lane closed</h1>
          <p className="mt-3 text-muted">
            {entryAnswers
              ? 'Nobody touches the wheel now. Here is what you called.'
              : 'You did not radio in any picks, so there is nothing to show. Watch the race and heckle accordingly.'}
          </p>
        </Reveal>
        {entryAnswers && (
          <Reveal index={1} className="mt-6">
            <PicksList config={event} answers={entryAnswers} />
          </Reveal>
        )}
        <Reveal index={2} className="mt-6">
          <WhatsAppCta url={wa} />
        </Reveal>
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
        <Reveal>
          <div className="flex items-center gap-2">
            <StatusDot status="open" />
            <Eyebrow>{event.name}</Eyebrow>
          </div>
          <CloseTimer closesAt={event.closesAt.toMillis()} className="mt-3" />
        </Reveal>
        <Divider className="my-8" />
        <Reveal index={1}>
          <h1 className="text-3xl font-semibold leading-tight tracking-tight" role="status">
            {ok ? 'Picks locked in' : 'Transmitting to race control'}
          </h1>
          <p className="mt-2 text-muted">
            {ok
              ? 'Copy that, ' + s.entry.name + '. Change your mind while the pit lane is open if you must.'
              : 'Hold the line while the signal gets through.'}
          </p>
        </Reveal>
        <Reveal index={2} className="mt-4">
          <PicksList config={event} answers={entryAnswers} />
        </Reveal>
        <Reveal index={3} className="mt-6 flex flex-col gap-3">
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
      </Shell>
    );
  }

  if (!s.user) {
    if (!started) {
      return (
        <Shell>
          <Hero config={event} status={scheduled ? 'scheduled' : 'open'} />
          <Reveal index={3} className="mt-auto pt-8">
            <Button className="w-full" onClick={() => setStarted(true)}>
              Get on the grid
              <ArrowRight size={20} weight="regular" aria-hidden="true" />
            </Button>
          </Reveal>
        </Shell>
      );
    }
    return <SignIn onGoogle={async () => void (await s.google())} />;
  }
  if (!s.entry && !confirmed) {
    return (
      <Profile
        user={s.user}
        phone={draft.phone}
        onPhone={(phone) => patch({ phone })}
        onContinue={() => setConfirmed(true)}
        onSwitch={() => {
          setStarted(true);
          void s.signOut();
        }}
      />
    );
  }

  // Signed in but the window has not opened: quiz is gated.
  if (scheduled) {
    return (
      <Shell>
        <Hero config={event} status="scheduled" />
        <Reveal index={3} className="mt-auto pt-8">
          <p role="status" className="mb-3 text-sm text-muted">
            You are on the grid, {accountName(s.user)}. The quiz unlocks by itself when picks open.
          </p>
          <Button className="w-full" disabled aria-disabled="true">
            Picks open in <Countdown target={event.opensAt.toMillis()} />
          </Button>
        </Reveal>
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

function LoadingSkeleton() {
  return (
    <Shell>
      <div aria-busy="true" aria-label="Loading" className="flex flex-col gap-4">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-14 w-64" />
        <Skeleton className="h-6 w-56" />
        <Skeleton className="mt-8 h-12 w-48" />
        <Skeleton className="mt-auto h-12 w-full" />
      </div>
    </Shell>
  );
}
