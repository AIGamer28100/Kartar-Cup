import { useState, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Link, useNavigate } from 'react-router';
import { Check, Gauge, Images, SignIn, SignOut, TicketIcon, User, WhatsappLogo, X } from '@phosphor-icons/react';
import { useAuth } from '../lib/auth';
import { signInGoogle } from '../lib/firebase';
import { isInAppBrowser } from '../lib/inAppBrowser';
import { signInError } from './SignIn';
import type { EventConfig } from '../lib/types';
import { useCountdown } from '../lib/useCountdown';
import Divider from '../components/Divider';
import type { PickMap } from './draft';
import { formatRemaining, optionLabel, safeWhatsappUrl } from './model';

export const SPRING = { type: 'spring', stiffness: 260, damping: 26 } as const;

/** Staggered spring reveal wrapper (transform + opacity only). */
export function Reveal({
  children,
  index = 0,
  className = '',
}: {
  children: ReactNode;
  index?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...SPRING, delay: reduce ? 0 : index * 0.07 }}
    >
      {children}
    </motion.div>
  );
}

const linkCls =
  'inline-flex min-h-11 items-center gap-2 whitespace-nowrap text-sm text-muted transition hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

/** Small text wordmark used as the header's logo placeholder — R27: no real Karter Cup artwork
 * is in this repo, only a plain dot+text mark in the site's own established style. Links home. */
function LogoMark() {
  return (
    <Link
      to="/"
      className="inline-flex min-h-11 items-center gap-2 whitespace-nowrap text-sm font-semibold tracking-tight text-ink transition hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <span className="h-2 w-2 shrink-0 rounded-full bg-accent" aria-hidden="true" />
      Kartar CUP
    </Link>
  );
}

/** Header sign-in: a real, working "Continue with Google" entry point on every page (not just the
 * hero), per R28 — still contextual/on-demand, never a page-wide gate. Same in-app-browser and
 * popup-error handling as the hero's own CTA, condensed for the header. This is the header's
 * general button with no other task to continue, so a successful sign-in here lands on /profile
 * (R31) — unlike the hero's quiz CTA or a booking checkout's sign-in, which stay in place (R28). */
function HeaderSignIn() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const navigate = useNavigate();
  if (isInAppBrowser()) return null; // hero's full InAppPanel is the real entry point there
  return (
    <div className="flex items-center gap-2">
      {err && <span className="hidden text-xs text-muted sm:inline">{err}</span>}
      <button
        type="button"
        className={linkCls}
        disabled={busy}
        onClick={async () => {
          setErr('');
          setBusy(true);
          try {
            await signInGoogle();
            navigate('/profile');
          } catch (e) {
            setErr(signInError(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <SignIn size={20} weight="regular" aria-hidden="true" />
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </div>
  );
}

/** Page shell. Left: logo placeholder linking home. Right: Events link, Host console link (hosts
 * only), and Sign out / Sign in. Sign-in works on every non-bare page (R28: on-demand, not a gate). */
export function Shell({ children, bare = false }: { children: ReactNode; bare?: boolean }) {
  const { ready, user, isHost } = useAuth();
  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-[87.5rem] flex-col px-6 pb-10 pt-4 md:px-10 md:pb-14 md:pt-6 lg:px-16">
      <div className="mb-6 flex min-h-11 items-center justify-between gap-4 md:mb-2">
        {bare ? <span /> : <LogoMark />}
        <div className="flex items-center gap-4">
          {!bare && (
            <Link to="/events" className={linkCls}>
              <TicketIcon size={20} weight="regular" aria-hidden="true" />
              Events
            </Link>
          )}
          {!bare && (
            <Link to="/gallery" className={`hidden sm:inline-flex ${linkCls}`}>
              <Images size={20} weight="regular" aria-hidden="true" />
              Gallery
            </Link>
          )}
          {!bare && user && isHost === true && (
            <Link to="/host" className={linkCls}>
              <Gauge size={20} weight="regular" aria-hidden="true" />
              Host console
            </Link>
          )}
          {!bare && user && (
            <Link to="/profile" className={linkCls}>
              <User size={20} weight="regular" aria-hidden="true" />
              Profile
            </Link>
          )}
          {!bare && ready && (user ? (
            <Link to="/logout" className={linkCls}>
              <SignOut size={20} weight="regular" aria-hidden="true" />
              Sign out
            </Link>
          ) : (
            <HeaderSignIn />
          ))}
        </div>
      </div>
      {children}
    </main>
  );
}

/** Only for the home page's single true hero `<h1>The Karter Cup</h1>`. */
export const H1 = 'text-hero font-semibold text-balance';
/** Section headings within a page (e.g. the home page's SectionHeading). */
export const H2 = 'text-h2 font-semibold text-balance';
/** The top-of-page title on every other page/view (Events, Gallery, Profile, the quiz flow, etc). */
export const PageTitle = 'text-h2 font-semibold text-balance';

/** Split composition: stacked on phones, two columns from md. Left = readout, right = active step. */
export function Split({ left, right }: { left: ReactNode; right?: ReactNode }) {
  return (
    <div className="grid flex-1 content-start gap-10 md:grid-cols-2 md:content-center md:items-start md:gap-14 lg:grid-cols-[1.15fr_1fr] lg:gap-24">
      <div className="flex min-w-0 flex-col">{left}</div>
      <div className="flex min-w-0 flex-col">{right}</div>
    </div>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="font-mono text-xs uppercase tracking-widest text-muted">{children}</p>
  );
}

export function WhatsAppCta({ url }: { url: string | undefined }) {
  const href = safeWhatsappUrl(url);
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-line bg-raised px-5 text-[1rem] font-medium text-ink transition duration-150 hover:border-muted active:translate-y-px active:scale-[0.98]"
    >
      <WhatsappLogo size={22} weight="regular" aria-hidden="true" />
      Join The Karter Cup WhatsApp community
    </a>
  );
}

/** Slim mono "Picks close in mm:ss" line for the open window. */
export function CloseTimer({ closesAt, className = '' }: { closesAt: number; className?: string }) {
  const { totalMs } = useCountdown(closesAt);
  return (
    <p className={`flex items-baseline gap-2 font-mono text-xs uppercase tracking-widest text-muted ${className}`}>
      <span>Picks close in</span>
      <span role="timer" className="text-sm tabular-nums text-ink">
        {formatRemaining(totalMs)}
      </span>
    </p>
  );
}

export function PicksList({ config, answers }: { config: EventConfig; answers: PickMap }) {
  return (
    <ol className="m-0 list-none p-0">
      {config.questions.map((q, i) => (
        <li key={q.id}>
          {i > 0 && <Divider />}
          <div className="py-4">
            <p className="text-sm text-muted">
              <span className="font-mono tabular-nums">{i + 1}</span>. {q.prompt}
            </p>
            <p className="mt-1 text-lg font-medium text-ink">{optionLabel(config, q, answers[q.id])}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function TickStrip({ config, ticks }: { config: EventConfig; ticks: Record<string, boolean> }) {
  const reduce = useReducedMotion();
  return (
    <ul className="m-0 flex list-none flex-wrap gap-2 p-0" aria-label="Correct answers">
      {config.questions.map((q, i) => (
        <motion.li
          key={q.id}
          initial={reduce ? false : { opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ ...SPRING, delay: reduce ? 0 : 0.4 + i * 0.08 }}
          className={`flex size-11 items-center justify-center rounded-lg border font-mono text-sm ${
            ticks[q.id] ? 'border-accent bg-accent text-accent-ink' : 'border-line text-muted'
          }`}
        >
          <span className="sr-only">
            Question {i + 1}: {ticks[q.id] ? 'correct' : 'missed'}
          </span>
          {ticks[q.id] ? (
            <Check size={20} weight="regular" aria-hidden="true" />
          ) : (
            <X size={20} weight="regular" aria-hidden="true" />
          )}
        </motion.li>
      ))}
    </ul>
  );
}
