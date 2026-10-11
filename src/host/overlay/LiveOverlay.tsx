import { useEffect, useState, type MouseEvent, type ReactNode } from 'react';
import QRCode from 'qrcode';
import { deriveStatus } from '../../lib/eventStatus';
import type { EventConfig } from '../../lib/types';
import { overlayClock, shortJoinUrl } from './overlayModel';

/**
 * The live overlay itself: what the room sees over the race. One component for every host (Document
 * PiP window, fallback popup, Mock Lab preview). It fills whatever box it is given and adapts with
 * container queries. Owner's call: the QR and the timer below it, nothing else (no join text, no
 * player count, no standings). Never scrolls; the only motion is the pulsing live dot (motion-safe).
 */

export type OverlayQuiz = Pick<EventConfig, 'name' | 'opensAt' | 'closesAt' | 'override' | 'winnerRevealed'>;

export interface OverlayData {
  /** Feeds still connecting. */
  loading: boolean;
  /** A feed failed (permission, network). */
  error: string | null;
  /** The active quiz, or null when none is live. */
  quiz: OverlayQuiz | null;
  /** Newest unrevoked /play/<token> URL, or null when the quiz has no link yet. */
  joinUrl: string | null;
  /** Where the host creates a link (the owning watch party's Quiz tab). */
  quizTabHref: string;
}

export interface LiveOverlayProps extends OverlayData {
  /** Fixed clock (Mock Lab, tests). Omit to tick in real time. */
  nowMs?: number;
  /** Open the Quiz tab in the MAIN window (PiP mode). Without it the link opens a new tab. */
  onQuizTab?: () => void;
}

const label = 'font-mono text-[clamp(0.6rem,6cqh,0.95rem)] uppercase leading-none tracking-[0.14em] text-muted';
const big = 'font-num text-[clamp(1.5rem,min(20cqh,11cqw),5rem)] font-bold italic leading-[0.9] tabular-nums';
const phrase = 'text-[clamp(1rem,min(11cqh,7cqw),2.25rem)] font-semibold leading-tight';

function useTick(fixed: number | undefined): number {
  const [now, setNow] = useState(() => fixed ?? Date.now());
  useEffect(() => {
    if (fixed !== undefined) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [fixed]);
  return fixed ?? now;
}

function useQr(url: string | null): string | null {
  const [qr, setQr] = useState<{ url: string; data: string } | null>(null);
  useEffect(() => {
    if (!url) return;
    let live = true;
    // Pure black on white: the most forgiving contrast for a phone camera across a room.
    QRCode.toDataURL(url, { margin: 1, width: 480, errorCorrectionLevel: 'M', color: { dark: '#000000', light: '#ffffff' } })
      .then((data) => live && setQr({ url, data }))
      .catch(() => live && setQr(null));
    return () => {
      live = false;
    };
  }, [url]);
  return qr && qr.url === url ? qr.data : null;
}

/** Full-size frame shared by every state: the size container, navy, never scrolls. */
function Frame({ children, label: aria }: { children: ReactNode; label: string }) {
  return (
    <div
      role="region"
      aria-label={aria}
      style={{ containerType: 'size' }}
      className="relative h-full w-full overflow-hidden bg-base text-ink"
    >
      {children}
    </div>
  );
}

function LiveDot() {
  return <span aria-hidden="true" className="inline-block size-[clamp(0.45rem,4cqh,0.8rem)] shrink-0 rounded-full bg-accent motion-safe:animate-pulse" />;
}

function Message({ title, body, tone = 'muted' }: { title: string; body: ReactNode; tone?: 'muted' | 'error' }) {
  return (
    <Frame label="Live quiz overlay">
      <div className="flex h-full flex-col justify-center gap-[3cqmin] p-[6cqmin]">
        <p className={`flex items-center gap-2 ${label}`}>
          <LiveDot /> Live quiz
        </p>
        <p className={`${phrase} ${tone === 'error' ? 'text-accent-text' : 'text-ink'}`}>{title}</p>
        <div className="text-[clamp(0.7rem,6.5cqh,1.1rem)] leading-snug text-muted">{body}</div>
      </div>
    </Frame>
  );
}

function QrBlock({ joinUrl, quizTabHref, onQuizTab }: { joinUrl: string | null; quizTabHref: string; onQuizTab?: () => void }) {
  const qr = useQr(joinUrl);
  const box = 'aspect-square h-full max-w-full shrink-0 rounded-[3cqmin]';
  if (!joinUrl) {
    const click = (e: MouseEvent<HTMLAnchorElement>) => {
      if (!onQuizTab) return;
      e.preventDefault();
      onQuizTab();
    };
    return (
      <div className={`${box} flex flex-col justify-center gap-[2cqmin] border-2 border-dashed border-accent p-[3cqmin]`}>
        <p className="text-[clamp(0.7rem,6.5cqh,1.1rem)] font-semibold leading-tight">No join link yet</p>
        <a
          href={quizTabHref}
          target={onQuizTab ? undefined : '_blank'}
          rel="noreferrer"
          onClick={click}
          className="text-[clamp(0.6rem,5.5cqh,0.95rem)] leading-snug text-accent-text underline underline-offset-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Create a quiz link in the event&apos;s Quiz tab
        </a>
      </div>
    );
  }
  return qr ? (
    <img src={qr} alt={`QR code to join: ${shortJoinUrl(joinUrl)}`} className={`${box} bg-white object-contain p-[1.5cqmin]`} />
  ) : (
    <div role="img" aria-label="QR code loading" className={`${box} bg-raised`} />
  );
}

export default function LiveOverlay({ loading, error, quiz, joinUrl, quizTabHref, nowMs, onQuizTab }: LiveOverlayProps) {
  const now = useTick(nowMs);

  if (error) return <Message tone="error" title="Live feed lost" body={<>{error}. The overlay reconnects on its own; check the host console if this stays.</>} />;
  if (loading) {
    return (
      <Frame label="Live quiz overlay, connecting">
        <div className="flex h-full gap-[4cqmin] p-[5cqmin]" aria-busy="true">
          <div className="aspect-square h-full max-w-[50cqw] shrink-0 rounded-[3cqmin] bg-raised" />
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-[4cqh]">
            <p className={`flex items-center gap-2 ${label}`}>
              <LiveDot /> Connecting
            </p>
            <div className="h-[16cqh] w-3/4 rounded bg-raised" />
            <div className="h-[16cqh] w-1/2 rounded bg-raised" />
          </div>
        </div>
      </Frame>
    );
  }
  if (!quiz) return <Message title="No live quiz" body="Set a quiz live from the host console and it appears here." />;

  const status = deriveStatus(quiz, now);
  const clock = overlayClock(status, quiz.opensAt.toMillis(), quiz.closesAt.toMillis(), now);
  const clockBody = clock.counting ? <p className={big}>{clock.value}</p> : <p className={phrase}>{clock.value}</p>;

  return (
    <Frame label={`Live quiz overlay: ${quiz.name}`}>
      <div className="flex h-full flex-col items-center gap-[3cqh] p-[4cqmin]">
        <div className="flex min-h-0 w-full flex-1 justify-center">
          <QrBlock joinUrl={joinUrl} quizTabHref={quizTabHref} onQuizTab={onQuizTab} />
        </div>
        <div className="flex shrink-0 flex-col items-center gap-[1.5cqh] text-center" aria-live="off">
          <p className={`flex items-center gap-[0.5em] ${label}`}>
            <LiveDot /> {clock.label}
          </p>
          {clockBody}
        </div>
      </div>
    </Frame>
  );
}
