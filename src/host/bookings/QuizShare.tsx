import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import Button from '../../components/Button';
import { logAudit } from '../../lib/audit';
import { watchEventConfig } from '../../lib/db';
import { createPlayLink, playUrl, revokePlayLink, watchPlayLinks, type PlayLink } from '../../lib/playLinks';

/** The private quiz link and QR for one watch party's quiz (the quiz is not on the public site). */
export default function QuizShare({ quizId }: { quizId: string }) {
  const [exists, setExists] = useState<boolean | undefined>(undefined);
  const [links, setLinks] = useState<PlayLink[] | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setExists(undefined);
    return watchEventConfig(quizId, (c) => setExists(c !== null), (e) => setErr(e.message));
  }, [quizId]);

  useEffect(() => {
    setLinks(undefined);
    return watchPlayLinks(quizId, setLinks, (e) => setErr(e.message));
  }, [quizId]);

  const link = links?.[0];

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setErr(null);
    try {
      await fn();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'That did not work. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="Quiz link" className="mt-4 rounded-lg border border-line bg-raised p-4">
      <h3 className="text-sm font-semibold">Quiz link</h3>
      <p className="mt-1 text-sm text-muted">
        The quiz is not on the public site. Share this link or QR code only with people at the event.
      </p>
      {exists === false ? (
        <p className="mt-3 text-sm text-muted">Save the quiz first. A link can be created once the quiz exists.</p>
      ) : links === undefined || exists === undefined ? (
        <p className="mt-3 text-sm text-muted">Loading...</p>
      ) : link ? (
        <LinkBody link={link} busy={busy} onRevoke={(t) => run(async () => { await revokePlayLink(t); logAudit('quiz.link-revoke', quizId); })} />
      ) : (
        <div className="mt-3">
          <Button variant="secondary" disabled={busy} onClick={() => void run(async () => { await createPlayLink(quizId); logAudit('quiz.link-create', quizId); })}>
            {busy ? 'Creating...' : 'Create quiz link'}
          </Button>
        </div>
      )}
      {err && (
        <p role="alert" className="mt-3 text-sm text-accent-text">
          {err}
        </p>
      )}
    </section>
  );
}

const linkBtnCls =
  'inline-flex min-h-12 items-center justify-center rounded-lg border border-line bg-raised px-5 font-medium text-ink hover:border-muted';

function LinkBody({ link, busy, onRevoke }: { link: PlayLink; busy: boolean; onRevoke: (token: string) => void }) {
  const url = playUrl(link.token);
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState<'yes' | 'failed' | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(url, { margin: 2, width: 720, color: { dark: '#111', light: '#fff' } })
      .then((d) => !cancelled && setQr(d))
      .catch(() => !cancelled && setQr(null));
    return () => {
      cancelled = true;
    };
  }, [url]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied('yes');
    } catch {
      setCopied('failed');
    }
    window.setTimeout(() => setCopied(null), 2500);
  }

  function revoke() {
    if (!window.confirm('Revoke this link? It stops working straight away and guests using it can no longer submit picks.')) return;
    onRevoke(link.token);
  }

  return (
    <div className="mt-3 grid gap-4 md:grid-cols-[auto_1fr]">
      {qr ? (
        <img src={qr} alt="QR code for the quiz link" className="size-64 rounded-lg border border-line bg-white p-2" />
      ) : (
        <div className="size-64 rounded-lg border border-line bg-base" aria-hidden="true" />
      )}
      <div className="min-w-0 space-y-3">
        <input
          readOnly
          value={url}
          aria-label="Quiz link"
          onFocus={(e) => e.currentTarget.select()}
          className="min-h-11 w-full rounded-lg border border-line bg-base px-3 font-mono text-sm text-ink"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => void copy()}>
            {copied === 'yes' ? 'Copied' : 'Copy link'}
          </Button>
          {qr && (
            <a href={qr} download="quiz-qr.png" className={linkBtnCls}>
              Download PNG
            </a>
          )}
          <a href={url} target="_blank" rel="noreferrer" className={linkBtnCls}>
            Open
          </a>
          <Button variant="ghost" disabled={busy} onClick={revoke}>
            Revoke
          </Button>
        </div>
        <p role="status" className="text-sm text-muted">
          {copied === 'failed' ? 'Could not copy. Select the link above and copy it manually.' : ''}
        </p>
      </div>
    </div>
  );
}
