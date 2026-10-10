import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { motion, useReducedMotion } from 'framer-motion';
import type { EventConfig } from '../../lib/types';
import { deriveStatus } from '../../lib/eventStatus';

function useCountdown(targetMs: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (targetMs === null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [targetMs]);
  if (targetMs === null) return null;
  return Math.max(0, targetMs - now);
}

function fmt(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = String(Math.floor(s / 3600)).padStart(2, '0');
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const sec = String(s % 60).padStart(2, '0');
  return `${h}:${m}:${sec}`;
}

/** `joinUrl` is the quiz's /play/<token> link (the quiz is link-only, so the site root is no way in);
 * without one there is nothing to scan and the QR block is left out. */
export default function LobbyScreen({ config, entryCount, joinUrl = null }: { config: EventConfig; entryCount: number; joinUrl?: string | null }) {
  const [qr, setQr] = useState<string | null>(null);
  const reduce = useReducedMotion();
  const status = deriveStatus(config, Date.now());
  const closesMs = status === 'open' || status === 'scheduled' ? config.closesAt.toMillis() : null;
  const remaining = useCountdown(closesMs);

  useEffect(() => {
    if (!joinUrl) return;
    let cancelled = false;
    QRCode.toDataURL(joinUrl, { margin: 1, width: 480, color: { dark: '#111', light: '#fff' } })
      .then((url) => !cancelled && setQr(url))
      .catch(() => !cancelled && setQr(null));
    return () => {
      cancelled = true;
    };
  }, [joinUrl]);

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-10 px-8 py-12 text-center">
      <motion.p
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-[clamp(0.9rem,2vw,1.5rem)] uppercase tracking-[0.3em] text-muted"
      >
        The Karter Cup
      </motion.p>
      <motion.h1
        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7, delay: 0.1 }}
        className="text-[clamp(2.5rem,7vw,6rem)] font-semibold leading-none"
      >
        {config.name}
      </motion.h1>
      <div className="grid w-full max-w-5xl grid-cols-1 items-center gap-10 md:grid-cols-2">
        {joinUrl && (
        <motion.div
          initial={reduce ? { opacity: 0 } : { opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="flex flex-col items-center gap-3"
        >
          <p className="text-[clamp(0.9rem,1.6vw,1.25rem)] uppercase tracking-widest text-muted">
            Scan to join
          </p>
          {qr ? (
            <img src={qr} alt="QR code to join the quiz" className="size-[clamp(10rem,20vw,22rem)] rounded-2xl border border-line bg-white p-3" />
          ) : (
            <div className="size-[clamp(10rem,20vw,22rem)] animate-pulse rounded-2xl bg-raised" />
          )}
        </motion.div>
        )}
        <motion.div
          initial={reduce ? { opacity: 0 } : { opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex flex-col items-center gap-6"
        >
          <div>
            <p className="text-[clamp(0.9rem,1.6vw,1.25rem)] uppercase tracking-widest text-muted">
              Grid entries
            </p>
            <p
              aria-live="polite"
              className="font-mono text-[clamp(3rem,9vw,7rem)] font-semibold leading-none tabular-nums text-accent-text"
            >
              {entryCount}
            </p>
          </div>
          {remaining !== null && (
            <div>
              <p className="text-[clamp(0.9rem,1.6vw,1.25rem)] uppercase tracking-widest text-muted">
                {status === 'scheduled' ? 'Opens in' : 'Picks lock in'}
              </p>
              <p className="font-mono text-[clamp(2rem,6vw,4.5rem)] tabular-nums" aria-live="polite">
                {fmt(remaining)}
              </p>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
