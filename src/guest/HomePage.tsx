import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import { motion, useScroll, useTransform } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Images,
  InstagramLogo,
  WhatsappLogo,
} from "@phosphor-icons/react";
import Divider from "../components/Divider";
import Skeleton, { PageSkeleton } from "../components/Skeleton";
import TrackMap from "../components/TrackMap";
import { ALL_RACES, nextRace } from "../config/calendar";
import { trackForRace } from "../config/tracks";
import { GALLERY_PLACEHOLDERS, gallerySrc } from "./galleryData";
import { istReadout, safeWhatsappUrl } from "./model";
import { Eyebrow, H1, H2, Reveal, Shell } from "./parts";
import ChampionshipSection from "./Championship";
import QuizBanner from "./QuizBanner";
import { ScrollProgressPath, useDesktopMotion } from "./scrollFx";
import { useGuestSession } from "./useGuestSession";
import { useCountdown } from "../lib/useCountdown";
import { nextSession, raceStartFor } from "../lib/f1api";
import { useSchedule } from "../lib/useSchedule";
import { usePageMeta } from "../lib/pageMeta";
import { watchBookingEvents } from "../lib/bookings";
import type { BookingEvent } from "../lib/types";
import { nextHostedRace } from "./eventsModel";

const GuestApp = lazy(() => import("./GuestApp"));

const INSTAGRAM_CUP = "https://www.instagram.com/thekartercup/";
const INSTAGRAM_CLUB = "https://www.instagram.com/thekarterclub/";

const linkCls =
  "inline-flex min-h-11 items-center gap-2 text-ink underline decoration-line underline-offset-4 transition hover:decoration-accent";

/** Section heading used across the community page (distinct from the quiz's H1 to keep the
 * page's own type rhythm — same clamp scale, reused, not duplicated ad hoc). */
function SectionHeading({
  eyebrow,
  children,
}: {
  eyebrow: string;
  children: string;
}) {
  return (
    <Reveal>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className={`mt-3 ${H2}`}>{children}</h2>
    </Reveal>
  );
}

/** R26: the checkered-motif divider is used sparingly (1-2 spots total) — under the hero, and
 * once more as the single accent strip before "Join the community". Every other section break
 * uses the plain Divider, not the brand motif. */
function CheckerDivider() {
  return (
    <div
      className="divider-checker my-16 w-full rounded-full md:my-24 lg:my-28"
      aria-hidden="true"
    />
  );
}

function PlainDivider() {
  return <Divider className="my-16 md:my-24 lg:my-28" />;
}

/** Merged hero + "what's on next", per the user's explicit layout: hero text at 30-40% width,
 * the next race (wall clock, track, details) at 60-70%, side by side at the TOP of the page —
 * height-matched to the hero's own natural height (the right column scales its content down to
 * fit, never the other way around). QuizBanner is NOT inside this row (kept below, full-width)
 * so height-matching stays predictable regardless of quiz state. */
function HeroAndNextRace() {
  const next = useMemo(() => nextRace(new Date(), ALL_RACES), []);
  // R47: "next watch party" is the next HOSTED race, which can be later than the next race
  // on the calendar (e.g. Malaysia is not hosted, Singapore is). Until booking events load, or if
  // they fail to, nothing watch-party related is claimed.
  const [bookingEvents, setBookingEvents] = useState<BookingEvent[]>([]);
  useEffect(() => watchBookingEvents(setBookingEvents, () => setBookingEvents([])), []);
  const hostedNext = useMemo(() => nextHostedRace(new Date(), ALL_RACES, bookingEvents), [bookingEvents]);
  const track = next ? trackForRace(next.id) : null;
  const { schedule, settled } = useSchedule(next?.season);
  const targetMs = next ? raceStartFor(next, schedule).ms : 0;
  const upNext = next ? nextSession(schedule?.get(next.round), Date.now()) : null;
  const trackWrapRef = useRef<HTMLDivElement>(null);
  const desktopMotion = useDesktopMotion();
  const { scrollYProgress } = useScroll({
    target: trackWrapRef,
    offset: ["start start", "end start"],
  });
  const trackY = useTransform(scrollYProgress, [0, 1], [0, 24]);
  const trackOpacity = useTransform(scrollYProgress, [0, 1], [1, 0.5]);

  return (
    <div className="grid gap-10 lg:grid-cols-[44fr_56fr] lg:items-center lg:gap-14">
      <div className="flex flex-col justify-center">
        <Reveal>
          <Eyebrow>Chennai &amp; Coimbatore · motorsport community</Eyebrow>
          <h1 className={`mt-4 ${H1}`}>The Karter Cup</h1>
          <p className="mt-6 max-w-[40ch] text-lead text-pretty text-muted md:mt-8">
            A leisure go-karting league and F1-style motorsport community —
            karting days, sim racing and watch parties, run by people who
            actually turn up.
          </p>
        </Reveal>
        <Reveal index={1} className="mt-6">
          <Link
            to="/events"
            className="text-gradient-brand inline-flex min-h-12 items-center gap-2 rounded-lg border border-line bg-raised px-5 text-[1rem] font-semibold transition duration-150 hover:border-muted active:translate-y-px active:scale-[0.98]"
          >
            See the full calendar
          </Link>
        </Reveal>
      </div>

      {next && (
        <div
          ref={trackWrapRef}
          className="flex flex-col justify-center gap-6 rounded-none border-y border-line py-8 lg:flex-row lg:items-center lg:gap-10"
        >
          <div className="min-w-0">
            <Reveal index={1}>
              <p className="font-mono text-xs uppercase tracking-widest text-muted">
                Round {String(next.round).padStart(2, "0")} ·{" "}
                {hostedNext?.id === next.id ? "watch-party night" : "next race"}
              </p>
              <p className="mt-1 text-h3 text-balance font-medium text-ink">
                {next.name}
              </p>
              <p className="mt-1 text-sm text-muted lg:text-[1rem]">
                {istReadout(targetMs).day} {istReadout(targetMs).month} ·{" "}
                {next.locality}, {next.country}
              </p>
              {hostedNext && hostedNext.id !== next.id && (
                <p className="mt-2 text-sm text-muted">
                  Next watch party:{" "}
                  <Link to="/events" className="font-medium text-accent underline decoration-line underline-offset-4 hover:decoration-accent">
                    {hostedNext.name}
                  </Link>{" "}
                  · {istReadout(raceStartFor(hostedNext, null).ms).day} {istReadout(raceStartFor(hostedNext, null).ms).month}
                </p>
              )}
              {upNext && upNext.key !== "race" && (
                <p className="mt-2 flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted">
                  <span className="relative flex size-2" aria-hidden="true">
                    <span className="absolute inline-flex size-full rounded-full bg-accent opacity-60 motion-safe:animate-ping" />
                    <span className="relative inline-flex size-2 rounded-full bg-accent" />
                  </span>
                  Next on track: {upNext.label} · {istReadout(upNext.startMs).day}{" "}
                  {istReadout(upNext.startMs).month} {istReadout(upNext.startMs).time} IST
                </p>
              )}
            </Reveal>
            <Reveal index={2} className="mt-5">
              <p className="font-mono text-xs uppercase tracking-widest text-muted">
                Lights out in
              </p>
              <div className="mt-2">
                {settled ? (
                  <CountdownReadout targetMs={targetMs} />
                ) : (
                  <Skeleton className="h-16 w-72 max-w-full" />
                )}
              </div>
            </Reveal>
          </div>
          {track && (
            <Reveal index={3} className="min-w-0 flex-1">
              <motion.div
                style={
                  desktopMotion ? { y: trackY, opacity: trackOpacity } : undefined
                }
              >
                <TrackMap track={track} animate className="mx-auto max-h-56 max-w-xs lg:max-h-64" />
              </motion.div>
            </Reveal>
          )}
        </div>
      )}
    </div>
  );
}

function AboutSection() {
  return (
    <div>
      <SectionHeading eyebrow="About">
        Karting, sim racing, watch parties
      </SectionHeading>
      <Reveal index={1} className="mt-6 grid gap-6 md:grid-cols-2">
        <p className="max-w-[42ch] text-[1rem] leading-relaxed text-pretty text-muted md:text-lg">
          The Karter Cup is a Chennai-founded, F1-style leisure go-karting
          league and motorsport community — and a small community-led company
          exploring how to run more of it: karting days, sim racing, and F1
          watch parties.
        </p>
        <p className="max-w-[42ch] text-[1rem] leading-relaxed text-pretty text-muted md:text-lg">
          It runs across two cities: karting events at{" "}
          <strong className="text-ink">ECR Speedway</strong> in Chennai and{" "}
          <strong className="text-ink">Prime Kart Zone</strong> in Coimbatore,
          with watch parties at rented event spaces in between race weekends.
        </p>
      </Reveal>
    </div>
  );
}

/** Five dots that light up red one per hour through the final 5 hours before lights out —
 * echoes F1's real start-light sequence (5 lights build up, then go out together), repurposed
 * here as an hour-by-hour countdown rather than the pre-race few seconds. Only rendered inside
 * that final 5h window. CSS glow only, no new dependency. */
function FiveLightsStrip({ hoursRemaining }: { hoursRemaining: number }) {
  const lit = Math.min(5, Math.max(0, Math.ceil(5 - hoursRemaining)));
  return (
    <div className="mt-3 flex gap-2" role="img" aria-label={`${lit} of 5 hours down to lights out`}>
      {Array.from({ length: 5 }, (_, i) => {
        const on = i < lit;
        return (
          <span
            key={i}
            aria-hidden="true"
            className={`h-3 w-3 rounded-full border transition-colors duration-500 ${
              on
                ? "border-accent bg-accent shadow-[0_0_10px_2px_var(--color-accent)]"
                : "border-line bg-raised"
            }`}
          />
        );
      })}
    </div>
  );
}

/** One segment of the countdown: a large mono numeral over a small uppercase label, the same
 * "timing-tower" numeral language already used elsewhere on the site (leaderboard, host console)
 * — chosen deliberately over an analog dial (tried twice, never read as premium here) because a
 * multi-day countdown is fundamentally a digital-display problem, not a clock-face one. */
function TimeSegment({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center px-6 first:pl-0 last:pr-0 sm:px-8">
      <p className="font-mono text-stat font-semibold tabular-nums text-ink">
        {value}
      </p>
      <p className="mt-2 font-mono text-label uppercase text-muted">
        {label}
      </p>
    </div>
  );
}

/** Segmented digital countdown — DAYS/HRS/MIN/SEC cells divided by thin lines, no card box
 * (design skill: no box unless elevation earns it). One accent used sparingly: the seconds
 * cell's numeral breathes red on each tick, echoing a live telemetry readout rather than a
 * static number. */
function CountdownReadout({ targetMs }: { targetMs: number }) {
  const { days, hours, minutes, seconds, done } = useCountdown(targetMs);
  const pad = (n: number) => String(n).padStart(2, "0");
  const hoursRemaining = (targetMs - Date.now()) / 3_600_000;

  if (done) {
    return (
      <p className="font-mono text-h3 font-semibold uppercase text-ink text-balance">
        Lights out
      </p>
    );
  }

  return (
    <div>
      <div
        className="inline-flex divide-x divide-line border-y border-line py-3"
        role="img"
        aria-label={`${days} days ${pad(hours)}:${pad(minutes)}:${pad(seconds)} to lights out`}
      >
        {days > 0 && <TimeSegment value={String(days)} label="Days" />}
        <TimeSegment value={pad(hours)} label="Hrs" />
        <TimeSegment value={pad(minutes)} label="Min" />
        <div className="flex flex-col items-center px-6 last:pr-0 sm:px-8">
          <p className="font-mono text-stat font-semibold tabular-nums text-accent motion-safe:animate-pulse motion-reduce:animate-none">
            {pad(seconds)}
          </p>
          <p className="mt-2 font-mono text-label uppercase text-muted">
            Sec
          </p>
        </div>
      </div>
      {hoursRemaining <= 5 && (
        <div className="mt-4">
          <FiveLightsStrip hoursRemaining={hoursRemaining} />
        </div>
      )}
    </div>
  );
}

/** R32 follow-up: only the NEXT event, with its real circuit visualization and a live countdown —
 * the full schedule moved to its own page (/events), so this section stays a single, focused
 * "what's on next" moment rather than a 3-up list. */
/** The quiz's entry point (R25: minor, event-only) — race details/clock/track now live in
 * HeroAndNextRace up top, so this is just the banner, full-width, no longer sharing a row. */
function QuizBannerSection({
  event,
  status,
  quizRevealed,
  onReveal,
}: {
  event: ReturnType<typeof useGuestSession>["event"];
  status: ReturnType<typeof useGuestSession>["status"];
  quizRevealed: boolean;
  onReveal: () => void;
}) {
  if (quizRevealed) return null;
  return (
    <div id="events">
      <QuizBanner event={event} status={status} onReveal={onReveal} />
    </div>
  );
}

function PartnershipsSection() {
  const slots = [
    "Title partner slot",
    "Venue partner slot",
    "Community partner slot",
  ];
  return (
    <div>
      <SectionHeading eyebrow="Partnerships">Collaborations</SectionHeading>
      <Reveal index={1} className="mt-6 grid gap-4 sm:grid-cols-3">
        {slots.map((label) => (
          <div
            key={label}
            className="flex min-h-24 items-center justify-center rounded-lg border border-dashed border-line text-center text-sm text-muted"
          >
            {label}
          </div>
        ))}
      </Reveal>
      <Reveal index={2} className="mt-4">
        <p className="text-[1rem] leading-relaxed text-pretty text-muted md:text-lg">
          Also exploring a sim-racing collaboration with racesims.in —
          exploratory only, not a confirmed partnership.
        </p>
      </Reveal>
    </div>
  );
}

function JoinCommunitySection({
  whatsappUrl,
}: {
  whatsappUrl: string | undefined;
}) {
  const wa = safeWhatsappUrl(whatsappUrl);
  return (
    <div>
      <SectionHeading eyebrow="Join in">Join the community</SectionHeading>
      <Reveal index={1} className="mt-6 flex flex-col gap-4">
        {wa ? (
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            className={linkCls}
          >
            <WhatsappLogo size={22} weight="regular" aria-hidden="true" />
            Join the WhatsApp community
          </a>
        ) : (
          <p className="text-muted">
            WhatsApp link not open yet — ask at the event.
          </p>
        )}
        <a
          href={INSTAGRAM_CUP}
          target="_blank"
          rel="noopener noreferrer"
          className={linkCls}
        >
          <InstagramLogo size={22} weight="regular" aria-hidden="true" />
          @thekartercup
        </a>
        <a
          href={INSTAGRAM_CLUB}
          target="_blank"
          rel="noopener noreferrer"
          className={linkCls}
        >
          <InstagramLogo size={22} weight="regular" aria-hidden="true" />
          @thekarterclub{" "}
          <span className="text-sm text-muted">
            — an initiative by The Karter Cup, for watch parties
          </span>
        </a>
      </Reveal>
    </div>
  );
}

/** R29 follow-up: the gallery moved to its own page (/gallery, mirroring /events) — this is now a
 * short teaser only, a few placeholder thumbnails plus a link, not the full horizontal-scroll strip. */
function GallerySection() {
  const preview = GALLERY_PLACEHOLDERS.slice(0, 4);
  return (
    <div>
      <SectionHeading eyebrow="Past events">Gallery</SectionHeading>
      <Reveal index={1} className="mt-6 grid grid-cols-4 gap-3">
        {preview.map((g) => (
          <img
            key={g.seed}
            src={gallerySrc(g.seed, 320, 320)}
            alt={g.caption}
            loading="lazy"
            className="aspect-square w-full rounded-lg border border-line object-cover"
          />
        ))}
      </Reveal>
      <Reveal index={2} className="mt-5">
        <Link
          to="/gallery"
          className="-mx-2 inline-flex min-h-11 items-center gap-2 px-2 text-sm font-medium text-ink transition hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <Images size={20} weight="regular" aria-hidden="true" />
          See the full gallery
          <ArrowRight size={16} weight="regular" aria-hidden="true" />
        </Link>
      </Reveal>
    </div>
  );
}

/** The Kartar CUP home page: a community/brand page. The quiz is demoted to a small, contextual
 * banner (see QuizBanner + quizGate) — never the hero's main CTA or its own headline section. */
export default function HomePage() {
  usePageMeta({});
  const s = useGuestSession();
  const [quizRevealed, setQuizRevealed] = useState(false);
  // The mobile tab bar's Predict tab (and its Home tab, to leave the quiz) navigate here with
  // router state; same-path navigations get a fresh key, so key drives the sync.
  const location = useLocation();
  useEffect(() => {
    setQuizRevealed((location.state as { quiz?: boolean } | null)?.quiz === true);
  }, [location.key, location.state]);

  if (quizRevealed) {
    return (
      <Suspense fallback={<PageSkeleton />}>
        <div className="mx-auto w-full max-w-[87.5rem] px-6 pt-4 md:px-10 md:pt-6 lg:px-16">
          <button
            type="button"
            onClick={() => setQuizRevealed(false)}
            className="inline-flex min-h-11 items-center gap-2 text-sm text-muted transition hover:text-ink"
          >
            <ArrowLeft size={18} weight="regular" aria-hidden="true" />
            Back to The Karter Cup
          </button>
        </div>
        <GuestApp />
      </Suspense>
    );
  }

  return (
    <>
      <ScrollProgressPath />
      <Shell>
        <HeroAndNextRace />
        <div className="mt-10">
          <QuizBannerSection
            event={s.event}
            status={s.status}
            quizRevealed={quizRevealed}
            onReveal={() => setQuizRevealed(true)}
          />
        </div>
        <CheckerDivider />
        <AboutSection />
        <PlainDivider />
        <ChampionshipSection season={nextRace(new Date(), ALL_RACES)?.season ?? 2026} />
        <PlainDivider />
        <JoinCommunitySection whatsappUrl={s.event?.whatsappUrl} />
        <CheckerDivider />
        <GallerySection />
        <PlainDivider />
        <PartnershipsSection />
      </Shell>
    </>
  );
}
