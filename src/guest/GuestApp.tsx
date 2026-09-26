import { useEffect, useRef, useState } from 'react';
import { ArrowRight } from '@phosphor-icons/react';
import Button from '../components/Button';
import Countdown from '../components/Countdown';
import Divider from '../components/Divider';
import Skeleton from '../components/Skeleton';
import StatusDot from '../components/StatusDot';
import { LIGHTS_OUT_UTC, QUESTIONS } from '../config/event';
import { scoreEntry } from '../lib/scoring';
import { useCountdown } from '../lib/useCountdown';
import { QUESTION_IDS, type Answers } from '../lib/types';
import { clearDraft, loadDraft, saveDraft, type Draft } from './draft';
import Quiz from './Quiz';
import SignIn, { PHONE_RE, validName } from './SignIn';
import { Eyebrow, PicksList, Reveal, Shell, TickStrip, WhatsAppCta } from './parts';
import { useGuestSession } from './useGuestSession';

const CLOSED_MSG = 'Pit lane closed: picks arrived after lights-out';

export default function GuestApp() {
  const s = useGuestSession();
  const [draft, setDraft] = useState<Draft>(loadDraft);
  const [started, setStarted] = useState(false);
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const seeded = useRef(false);

  const lightsOut = s.event?.lightsOutUtc?.toDate().getTime() ?? Date.parse(LIGHTS_OUT_UTC);
  const cd = useCountdown(lightsOut);
  const status = s.event?.status ?? 'open';
  const closed = status !== 'open' || cd.done;

  const patch = (p: Partial<Draft>) =>
    setDraft((d) => {
      const n = { ...d, ...p };
      saveDraft(n);
      return n;
    });

  // Seed the editable draft from a server entry once (so edits start from what was saved).
  useEffect(() => {
    if (s.entry && !seeded.current) {
      seeded.current = true;
      setDraft((d) => ({ ...d, answers: { ...s.entry!.answers }, name: s.entry!.name, phone: s.entry!.phone ?? d.phone }));
    }
  }, [s.entry]);

  const loading = !s.authReady || s.event === undefined || (s.user !== null && s.entry === undefined);
  if (loading) return <LoadingSkeleton />;

  if (s.event === null) {
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

  const answersComplete = (a: Partial<Answers>): a is Answers => QUESTION_IDS.every((id) => !!a[id]);

  // Own score
  if (s.entry && status === 'scored') {
    const r = s.results;
    const sc = r ? scoreEntry(s.entry.answers, r.answers) : null;
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
                <span className="text-3xl text-muted"> / {QUESTIONS.length}</span>
              </p>
              <div className="mt-6">
                <TickStrip ticks={sc.ticks} />
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
          <PicksList answers={s.entry.answers} />
        </Reveal>
        <Reveal index={3} className="mt-6">
          <WhatsAppCta />
        </Reveal>
      </Shell>
    );
  }

  // Locked / read-only
  if (closed && status !== 'scored') {
    return (
      <Shell>
        <Reveal>
          <div className="flex items-center gap-2">
            <StatusDot status="locked" />
            <Eyebrow>Lights out</Eyebrow>
          </div>
          <h1 className="mt-3 text-4xl font-semibold leading-none tracking-tight">Picks are locked</h1>
          <p className="mt-3 text-muted">
            {s.entry ? 'Nobody touches the wheel now. Here is what you called.' : 'You missed the grid this time. Watch the race and heckle accordingly.'}
          </p>
        </Reveal>
        {s.entry && (
          <Reveal index={1} className="mt-6">
            <PicksList answers={s.entry.answers} />
          </Reveal>
        )}
        <Reveal index={2} className="mt-6">
          <WhatsAppCta />
        </Reveal>
      </Shell>
    );
  }
  if (closed) {
    return (
      <Shell>
        <h1 className="text-4xl font-semibold tracking-tight">Results are in</h1>
        <p className="mt-3 text-muted">You did not enter this round. Catch the leaderboard on the big screen.</p>
      </Shell>
    );
  }

  const submit = async () => {
    if (!answersComplete(draft.answers)) return;
    setSubmitting(true);
    setError('');
    try {
      const phone = draft.phone.trim();
      await s.submit({ name: draft.name.trim(), phone: phone || undefined, answers: draft.answers });
      clearDraft();
      setEditing(false);
    } catch (e) {
      const code = (e as { code?: string }).code;
      setError(code === 'permission-denied' ? CLOSED_MSG : 'Transmission failed. Check your signal and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Confirmation
  if (s.entry && !editing) {
    const ok = !s.pending;
    return (
      <Shell>
        <Reveal>
          <div className="flex items-center gap-2">
            <StatusDot status="open" />
            <Eyebrow>Lights out in</Eyebrow>
          </div>
          <Countdown target={lightsOut} className="mt-2 block text-5xl font-medium" />
        </Reveal>
        <Divider className="my-8" />
        <Reveal index={1}>
          <h1 className="text-3xl font-semibold leading-tight tracking-tight" role="status">
            {ok ? 'Picks locked in' : 'Transmitting to race control'}
          </h1>
          <p className="mt-2 text-muted">
            {ok ? 'Copy that, ' + s.entry.name + '. Change your mind before lights-out if you must.' : 'Hold the line while the signal gets through.'}
          </p>
        </Reveal>
        <Reveal index={2} className="mt-4">
          <PicksList answers={s.entry.answers} />
        </Reveal>
        <Reveal index={3} className="mt-6 flex flex-col gap-3">
          <Button variant="secondary" onClick={() => { setError(''); patch({ step: 0 }); setEditing(true); }}>
            Edit my picks
          </Button>
          <WhatsAppCta />
        </Reveal>
      </Shell>
    );
  }

  // Sign-in / hero
  const profileOk = validName(draft.name) && (!draft.phone.trim() || PHONE_RE.test(draft.phone.trim()));
  if (!s.user || (!s.entry && !profileOk)) {
    if (!started && !s.user) {
      return (
        <Shell>
          <Reveal>
            <div className="flex items-center gap-2">
              <StatusDot status="open" />
              <Eyebrow>The Karter Cup watch party, Baku round</Eyebrow>
            </div>
            <h1 className="mt-6 text-6xl font-semibold leading-[0.95] tracking-tighter">Kartar CUP</h1>
            <p className="mt-4 max-w-[28ch] text-lg text-muted">
              Five calls. One winner. Radio your picks in before the lights go out.
            </p>
          </Reveal>
          <Reveal index={1} className="mt-10">
            <p className="text-sm text-muted">Lights out in</p>
            <Countdown target={lightsOut} className="block text-5xl font-medium" />
          </Reveal>
          <Reveal index={2} className="mt-auto pt-12">
            <Button className="w-full" onClick={() => setStarted(true)}>
              Get on the grid
              <ArrowRight size={20} weight="regular" aria-hidden="true" />
            </Button>
          </Reveal>
        </Shell>
      );
    }
    return (
      <SignIn
        name={draft.name}
        phone={draft.phone}
        onChange={patch}
        onGuest={async () => {
          await s.guest();
        }}
        onGoogle={async () => {
          const u = await s.google();
          if (!validName(draft.name) && u.displayName) patch({ name: u.displayName.trim() });
        }}
      />
    );
  }

  // Quiz
  return (
    <Quiz
      answers={draft.answers}
      step={Math.min(draft.step, QUESTIONS.length)}
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
