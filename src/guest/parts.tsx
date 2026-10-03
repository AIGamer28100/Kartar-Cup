import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Link, NavLink, useLocation, useNavigate } from 'react-router';
import { Check, Gauge, Images, List, SignIn, TicketIcon, User, WhatsappLogo, X } from '@phosphor-icons/react';
import { useAuth } from '../lib/auth';
import { signInGoogle } from '../lib/firebase';
import { isInAppBrowser } from '../lib/inAppBrowser';
import { signInError } from './SignIn';
import type { EventConfig } from '../lib/types';
import { useCountdown } from '../lib/useCountdown';
import Divider from '../components/Divider';
import { CONTACT } from '../config/contact';
import { DEVELOPER, OPERATOR } from '../config/legal';
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
  '-mx-2 inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-lg px-2 text-sm text-muted transition hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

/** Small text wordmark used as the header's logo placeholder — R27: no real Karter Cup artwork
 * is in this repo, only a plain dot+text mark in the site's own established style. Links home. */
function LogoMark() {
  return (
    <Link
      to="/"
      className="-mx-2 inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-lg px-2 text-sm font-semibold tracking-tight text-ink transition hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
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
export function useSignInToProfile() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const navigate = useNavigate();
  const start = async () => {
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
  };
  return { busy, err, start };
}

function HeaderSignIn() {
  const { busy, err, start } = useSignInToProfile();
  if (isInAppBrowser()) return null; // hero's full InAppPanel is the real entry point there
  return (
    <div className="flex items-center gap-2">
      {err && <span className="hidden text-xs text-muted sm:inline">{err}</span>}
      <button type="button" className={linkCls} disabled={busy} onClick={() => void start()}>
        <SignIn size={20} weight="regular" aria-hidden="true" />
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </div>
  );
}

const NAV_LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/events', label: 'Events', end: false },
  { to: '/cup', label: 'Cup', end: false },
  { to: '/gallery', label: 'Gallery', end: false },
  { to: '/about', label: 'About', end: false },
  { to: '/contact', label: 'Contact', end: false },
] as const;

const menuItemCls =
  'flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-left text-base text-muted transition hover:bg-raised hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent aria-[current=page]:text-ink';

/** Below md: burger button + dropdown panel. Absolutely positioned under the header (no layout
 * shift), z-30: above page content, below the tab bar chrome (z-40) and the R40 overlay (z-100).
 * Esc / tap-outside / route change / tabbing out all close it; focus returns to the button. */
function MobileMenu({ user, isHost, ready }: { user: unknown; isHost: boolean | null | undefined; ready: boolean }) {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  const { pathname } = useLocation();
  const btnRef = useRef<HTMLButtonElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const signIn = useSignInToProfile();
  const showSignIn = ready && !user && !isInAppBrowser();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    wrapRef.current?.querySelector<HTMLElement>('#site-menu a, #site-menu button')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div
      ref={wrapRef}
      className="md:hidden"
      onBlur={(e) => {
        if (open && e.relatedTarget && !wrapRef.current?.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      <button
        ref={btnRef}
        type="button"
        aria-expanded={open}
        aria-controls="site-menu"
        aria-label="Menu"
        onClick={() => setOpen((o) => !o)}
        className="-mr-2 inline-flex size-11 items-center justify-center rounded-lg text-ink transition hover:bg-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {open ? <X size={24} weight="regular" aria-hidden="true" /> : <List size={24} weight="regular" aria-hidden="true" />}
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div aria-hidden="true" className="fixed inset-0 z-20" onPointerDown={() => setOpen(false)} />
            <motion.div
              id="site-menu"
              initial={reduce ? false : { opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: -8 }}
              transition={reduce ? { duration: 0 } : { duration: 0.18, ease: 'easeOut' }}
              className="absolute inset-x-0 top-full z-30 mt-1 rounded-lg border border-line bg-base p-2 shadow-[0_16px_40px_rgb(0_0_0/0.5)]"
            >
              <nav aria-label="Site menu">
                <ul className="m-0 list-none p-0">
                  {NAV_LINKS.map((l) => (
                    <li key={l.to}>
                      <NavLink to={l.to} end={l.end} className={menuItemCls}>
                        {l.label}
                      </NavLink>
                    </li>
                  ))}
                  {Boolean(user) && isHost === true && (
                    <li>
                      <Link to="/host" className={menuItemCls}>
                        <Gauge size={20} weight="regular" aria-hidden="true" />
                        Host console
                      </Link>
                    </li>
                  )}
                </ul>
                <div className="mt-2 border-t border-line pt-2">
                  {Boolean(user) && (
                    <Link to="/profile" className={menuItemCls}>
                      <User size={20} weight="regular" aria-hidden="true" />
                      Profile
                    </Link>
                  )}
                  {showSignIn && (
                    <button type="button" className={menuItemCls} disabled={signIn.busy} onClick={() => void signIn.start()}>
                      <SignIn size={20} weight="regular" aria-hidden="true" />
                      {signIn.busy ? 'Signing in…' : 'Sign in'}
                    </button>
                  )}
                  {signIn.err && <p role="status" className="px-3 py-2 text-sm text-muted">{signIn.err}</p>}
                </div>
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Page shell. Left: logo placeholder linking home. Right: md+ the inline nav (Events, Gallery,
 * Host console for hosts, Profile, Sign out / Sign in); below md a burger menu (MobileMenu) holds
 * every public link plus the account actions. Sign-in works on every non-bare page (R28:
 * on-demand, not a gate). */
export function Shell({ children, bare = false }: { children: ReactNode; bare?: boolean }) {
  const { ready, user, isHost } = useAuth();
  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-[87.5rem] flex-col px-6 pt-4 md:px-10 md:pt-6 lg:px-16">
    <main className="flex min-w-0 flex-1 flex-col pb-10 md:pb-12">
      <div className="relative mb-6 flex min-h-11 items-center justify-between gap-4 md:mb-2">
        {bare ? <span /> : <LogoMark />}
        {!bare && <MobileMenu user={user} isHost={isHost} ready={ready} />}
        <div className="flex items-center gap-4 max-md:hidden">
          {!bare && (
            <Link to="/events" className={linkCls}>
              <TicketIcon size={20} weight="regular" aria-hidden="true" />
              Events
            </Link>
          )}
          {!bare && (
            <Link to="/gallery" className={linkCls}>
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
          {/* Sign out lives on the Profile page only (owner request); the navbar keeps just Sign in. */}
          {!bare && ready && !user && <HeaderSignIn />}
        </div>
      </div>
      {children}
    </main>
    {!bare && <SiteFooter />}
    </div>
  );
}

const footLinkCls =
  '-mx-2 inline-flex min-h-11 items-center rounded-lg px-2 text-sm text-muted transition hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent aria-[current=page]:text-ink';

const footHeadCls = 'font-mono text-xs uppercase tracking-widest text-muted';

/** Public-site footer (non-bare pages only). Sits outside <main> so it is the page's contentinfo
 * landmark. Own text wordmark only (R27). Brand + tagline, Explore links, Community/contact with
 * the real handles from src/config/contact.ts. On phones App pads the page bottom to clear the
 * fixed tab bar and race strip, so nothing here needs its own offset. */
function SiteFooter() {
  const whatsapp = safeWhatsappUrl(CONTACT.whatsappUrl);
  return (
    <footer className="mt-auto pt-6">
      <div aria-hidden="true" className="h-px w-full bg-gradient-brand opacity-60" />
      <div className="grid grid-cols-2 gap-x-6 gap-y-10 py-10 md:grid-cols-[1.3fr_1.5fr_1fr] md:gap-x-12 md:py-14">
        <div className="col-span-2 max-w-sm md:col-span-1">
          <p className="inline-flex items-center gap-2 text-base font-semibold tracking-tight text-ink">
            <span className="h-2 w-2 shrink-0 rounded-full bg-accent" aria-hidden="true" />
            Kartar CUP
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Karting events and sim racing. Watch parties with The Karter Club.
          </p>
        </div>
        <nav aria-labelledby="foot-explore" className="min-w-0">
          <h2 id="foot-explore" className={footHeadCls}>Explore</h2>
          <ul className="m-0 mt-2 list-none p-0 md:grid md:grid-cols-2 md:gap-x-8">
            {NAV_LINKS.map((l) => (
              <li key={l.to}>
                <NavLink to={l.to} end={l.end} className={footLinkCls}>
                  {l.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0">
          <h2 className={footHeadCls}>Community</h2>
          <ul aria-label="Community and contact" className="m-0 mt-2 list-none p-0">
            {CONTACT.instagram.map((i) => (
              <li key={i.handle}>
                <a href={i.url} target="_blank" rel="noopener noreferrer" className={`${footLinkCls} break-all`}>
                  {i.handle}
                  <span className="sr-only"> on Instagram (opens in a new tab)</span>
                </a>
              </li>
            ))}
            {whatsapp && (
              <li>
                <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={footLinkCls}>
                  WhatsApp
                  <span className="sr-only"> community (opens in a new tab)</span>
                </a>
              </li>
            )}
            <li>
              <Link to="/contact" className={footLinkCls}>
                Get in touch
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="flex flex-col gap-3 border-t border-line py-5 text-xs leading-relaxed text-muted md:flex-row md:items-start md:justify-between">
        <div className="grid gap-1">
          <p>
            Site design and software &copy; {DEVELOPER.year} {DEVELOPER.name}. All rights reserved.
          </p>
          <p>
            Operated by {OPERATOR.legalName.trim() || OPERATOR.shortName}, not by {DEVELOPER.name}. The Karter Club is an
            initiative by The Karter Cup. Independent fan site, not affiliated with Formula 1, its teams or drivers.
          </p>
        </div>
        <nav aria-label="Legal" className="flex gap-4">
          <Link to="/terms" className={footLinkCls}>
            Terms
          </Link>
          <Link to="/privacy" className={footLinkCls}>
            Privacy
          </Link>
        </nav>
      </div>
    </footer>
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
