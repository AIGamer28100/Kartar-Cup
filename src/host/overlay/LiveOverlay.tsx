import { useEffect, useState, type MouseEvent, type ReactNode } from 'react';
import QRCode from 'qrcode';
import { deriveStatus } from '../../lib/eventStatus';
import type { EventConfig, RankedRow } from '../../lib/types';
import { overlayClock, shortJoinUrl } from './overlayModel';

/**
 * The live overlay itself: what the room sees over the race. One component for every host (Document
 * PiP window, fallback popup, Mock Lab preview). It fills whatever box it is given and adapts with
 * container queries:
 *   - small (~360x220): QR + countdown + players in (after results: the leader instead of the clock);
 *   - wide (>= 30rem): adds the top 5 beside the QR once results are in.
 * Never scrolls; the only motion is the pulsing live dot (motion-safe). Gold is for scores only.
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
  entryCount: number;
  /** Top 5 once results are in; null before. */
  standings: RankedRow[] | null;
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
  const box = 'aspect-square h-full max-w-[50cqw] shrink-0 rounded-[3cqmin]';
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

function Stat({ title, children, className = '' }: { title: string; children: ReactNode; className?: string }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <p className={label}>{title}</p>
      <div className="mt-[1.5cqh] min-w-0 overflow-hidden whitespace-nowrap">{children}</div>
    </div>
  );
}

function Standings({ rows }: { rows: RankedRow[] }) {
  return (
    <div className="hidden min-h-0 min-w-0 flex-col @min-[30rem]:flex">
      <p className={label}>Standings</p>
      {rows.length === 0 ? (
        <p className="mt-[2cqh] text-[clamp(0.8rem,7cqh,1.4rem)] text-muted">No picks yet.</p>
      ) : (
        <ol className="mt-[1.5cqh] grid min-h-0 flex-1 auto-rows-fr divide-y divide-line">
          {rows.map((r) => (
            <li key={r.uid} className="grid min-h-0 grid-cols-[1.6em_minmax(0,1fr)_auto] items-center gap-x-[0.5em] text-[clamp(0.8rem,min(8.5cqh,4cqw),1.6rem)] leading-none">
              <span className="font-mono tabular-nums text-muted">{r.rank}</span>
              <span className="truncate font-semibold">{r.name}</span>
              <span className="font-num text-[1.2em] font-bold italic tabular-nums text-gold">{r.score}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export default function LiveOverlay({ loading, error, quiz, joinUrl, quizTabHref, entryCount, standings, nowMs, onQuizTab }: LiveOverlayProps) {
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
  const leader = standings?.[0] ?? null;
  const wideCols = standings
    ? '@min-[30rem]:grid-cols-[auto_minmax(0,0.85fr)_minmax(0,1.25fr)]'
    : '';

  const clockBody = clock.counting ? <p className={big}>{clock.value}</p> : <p className={phrase}>{clock.value}</p>;

  return (
    <Frame label={`Live quiz overlay: ${quiz.name}`}>
      <div className="grid h-full grid-rows-[minmax(0,1fr)_auto] gap-[3cqmin] p-[4cqmin]">
        <div className={`grid min-h-0 grid-cols-[auto_minmax(0,1fr)] gap-[4cqmin] ${wideCols}`}>
          <QrBlock joinUrl={joinUrl} quizTabHref={quizTabHref} onQuizTab={onQuizTab} />

          <div className="flex min-h-0 min-w-0 flex-col justify-between gap-[2cqh]">
            <p className={`flex min-w-0 items-center gap-[0.5em] ${label}`}>
              <LiveDot />
              <span className="truncate">{quiz.name}</span>
            </p>
            {leader ? (
              <>
                {/* Small window: the leader replaces the (by now finished) clock. */}
                <Stat title="Leader" className="@min-[30rem]:hidden">
                  <p className="flex min-w-0 items-baseline gap-[0.4em]">
                    <span className="truncate text-[clamp(1rem,min(11cqh,7cqw),2.25rem)] font-semibold">{leader.name}</span>
                    <span className="font-num text-[clamp(1.25rem,min(14cqh,9cqw),3rem)] font-bold italic tabular-nums text-gold">{leader.score}</span>
                  </p>
                </Stat>
                <Stat title={clock.label} className="hidden @min-[30rem]:block">
                  {clockBody}
                </Stat>
              </>
            ) : (
              <Stat title={clock.label}>
                <span aria-live="off">{clockBody}</span>
              </Stat>
            )}
            <Stat title="Players in">
              <p className={big} aria-live="polite">
                {entryCount}
              </p>
            </Stat>
          </div>

          {standings && <Standings rows={standings} />}
        </div>

        <p className="flex min-w-0 items-center justify-between gap-[1em] text-[clamp(0.6rem,6cqh,1rem)] leading-none">
          {joinUrl ? (
            <>
              <span className="shrink-0 font-semibold uppercase tracking-[0.12em] text-muted">Scan or visit</span>
              <span className="min-w-0 truncate font-mono text-ink" dir="rtl">
                {/* rtl truncation keeps the token end visible; the bidi isolate keeps the URL itself in order */}
                <bdi>{shortJoinUrl(joinUrl)}</bdi>
              </span>
            </>
          ) : (
            <span className="truncate text-muted">Guests join with the link or QR the host shares.</span>
          )}
        </p>
      </div>
    </Frame>
  );
}
