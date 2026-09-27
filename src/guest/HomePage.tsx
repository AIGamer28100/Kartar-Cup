import { lazy, Suspense, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { motion, useScroll, useTransform } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Images,
  InstagramLogo,
  WhatsappLogo,
} from "@phosphor-icons/react";
import Divider from "../components/Divider";
import { PageSkeleton } from "../components/Skeleton";
import TrackMap from "../components/TrackMap";
import { ALL_RACES, nextRace } from "../config/calendar";
import { trackForRace } from "../config/tracks";
import { GALLERY_PLACEHOLDERS, gallerySrc } from "./galleryData";
import { istReadout, safeWhatsappUrl } from "./model";
import { Eyebrow, H1, Reveal, Shell, Split } from "./parts";
import QuizBanner from "./QuizBanner";
import { ScrollProgressPath, useDesktopMotion } from "./scrollFx";
import { useGuestSession } from "./useGuestSession";
import { useCountdown } from "../lib/useCountdown";

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
      <h2 className={`mt-2 ${H1}`}>{children}</h2>
    </Reveal>
  );
}

/** R26: the checkered-motif divider is used sparingly (1-2 spots total) — under the hero, and
 * once more as the single accent strip before "Join the community". Every other section break
 * uses the plain Divider, not the brand motif. */
function CheckerDivider() {
  return (
    <div
      className="divider-checker my-14 w-full rounded-full"
      aria-hidden="true"
    />
  );
}

function PlainDivider() {
  return <Divider className="my-14" />;
}

function CommunityHero({
  trackId,
  onSeeWhatsOn,
}: {
  trackId: string | undefined;
  onSeeWhatsOn: () => void;
}) {
  const track = trackId ? trackForRace(trackId) : null;
  const trackWrapRef = useRef<HTMLDivElement>(null);
  const desktopMotion = useDesktopMotion();
  const { scrollYProgress } = useScroll({
    target: trackWrapRef,
    offset: ["start start", "end start"],
  });
  const trackY = useTransform(scrollYProgress, [0, 1], [0, 40]);
  const trackOpacity = useTransform(scrollYProgress, [0, 1], [1, 0.4]);
  return (
    <Split
      left={
        <>
          <Reveal>
            <Eyebrow>Chennai &amp; Coimbatore · motorsport community</Eyebrow>
            <h1 className={`mt-6 ${H1}`}>The Karter Cup</h1>
            <p className="mt-4 max-w-[36ch] text-lg text-muted md:text-xl">
              A leisure go-karting league and F1-style motorsport community —
              karting days, sim racing and watch parties, run by people who
              actually turn up.
            </p>
          </Reveal>
          <Reveal index={1} className="mt-8">
            <button
              type="button"
              onClick={onSeeWhatsOn}
              className="text-gradient-brand inline-flex min-h-12 items-center gap-2 rounded-lg border border-line bg-raised px-5 text-[1rem] font-semibold transition duration-150 hover:border-muted active:translate-y-px active:scale-[0.98]"
            >
              See what&rsquo;s on
            </button>
          </Reveal>
        </>
      }
      right={
        track ? (
          <div
            ref={trackWrapRef}
            className="rounded-none border-y border-line py-8"
          >
            {/* R29: subtle scroll-linked depth on the track-line as the guest scrolls past the
               hero — desktop only (useDesktopMotion drops it on touch/narrow + reduced motion). */}
            <motion.div
              style={
                desktopMotion ? { y: trackY, opacity: trackOpacity } : undefined
              }
            >
              <TrackMap track={track} animate className="mx-auto max-w-md" />
            </motion.div>
          </div>
        ) : undefined
      }
    />
  );
}

function AboutSection() {
  return (
    <div>
      <SectionHeading eyebrow="About">
        Karting, sim racing, watch parties
      </SectionHeading>
      <Reveal index={1} className="mt-6 grid gap-6 md:grid-cols-2">
        <p className="max-w-[42ch] text-muted md:text-lg">
          The Karter Cup is a Chennai-founded, F1-style leisure go-karting
          league and motorsport community — and a small community-led company
          exploring how to run more of it: karting days, sim racing, and F1
          watch parties.
        </p>
        <p className="max-w-[42ch] text-muted md:text-lg">
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

/** F1-broadcast-style digital countdown display: a dark segmented-numeral pill, the way a live
 * session clock reads on TV (styled after that convention — never the sponsor's actual name or
 * mark, per R27's same principle applied to a third party's trademark). Shows the 5-lights strip
 * once inside the final 5 hours. */
function CountdownReadout({ targetMs }: { targetMs: number }) {
  const { days, hours, minutes, seconds, totalMs, done } = useCountdown(targetMs);
  const pad = (n: number) => String(n).padStart(2, "0");
  const hoursRemaining = totalMs / 3_600_000;
  return (
    <div>
      <div className="inline-flex items-center rounded-md border border-line bg-base px-4 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <p className="font-mono text-3xl font-semibold tabular-nums tracking-wider text-ink">
          {done ? (
            "LIGHTS OUT"
          ) : (
            <>
              {days > 0 && <span className="mr-2 text-lg align-middle">{days}d</span>}
              {pad(hours)}:{pad(minutes)}:{pad(seconds)}
            </>
          )}
        </p>
      </div>
      {!done && hoursRemaining <= 5 && (
        <FiveLightsStrip hoursRemaining={hoursRemaining} />
      )}
    </div>
  );
}

/** R32 follow-up: only the NEXT event, with its real circuit visualization and a live countdown —
 * the full schedule moved to its own page (/events), so this section stays a single, focused
 * "what's on next" moment rather than a 3-up list. */
function UpcomingEventsSection({
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
  const next = useMemo(() => nextRace(new Date(), ALL_RACES), []);
  const track = next ? trackForRace(next.id) : null;
  const targetMs = next ? Date.parse(`${next.raceDate}T13:00:00Z`) : 0;

  return (
    <div id="events">
      <SectionHeading eyebrow="Upcoming">What&rsquo;s on next</SectionHeading>
      {next ? (
        <div className="mt-8 flex flex-col gap-10 lg:grid lg:grid-cols-[3fr_7fr] lg:items-center lg:gap-16">
          {track && (
            <Reveal className="lg:order-2">
              <div className="rounded-none border-y border-line py-8">
                <TrackMap track={track} animate className="mx-auto max-w-xl lg:max-w-none" />
              </div>
            </Reveal>
          )}
          <div className="lg:order-1">
            <Reveal index={1}>
              <p className="font-mono text-xs uppercase tracking-widest text-muted">
                Round {String(next.round).padStart(2, "0")} · watch-party
                night
              </p>
              <p className="mt-2 text-2xl font-medium text-ink">
                {next.name}
              </p>
              <p className="mt-1 text-muted">
                {istReadout(targetMs).day} {istReadout(targetMs).month} ·{" "}
                {next.locality}, {next.country}
              </p>
            </Reveal>
            <Reveal index={2} className="mt-6">
              <p className="font-mono text-xs uppercase tracking-widest text-muted">
                Lights out in
              </p>
              <div className="mt-1">
                <CountdownReadout targetMs={targetMs} />
              </div>
            </Reveal>
            <Reveal index={3} className="mt-6">
              <Link to="/events" className={linkCls}>
                See the full calendar
                <ArrowRight size={18} weight="regular" aria-hidden="true" />
              </Link>
            </Reveal>
          </div>
        </div>
      ) : (
        <Reveal index={1} className="mt-6">
          <p className="text-muted">
            No races left on the calendar — check back for the next season.
          </p>
        </Reveal>
      )}
      {!quizRevealed && (
        <div className="mt-8">
          <QuizBanner event={event} status={status} onReveal={onReveal} />
        </div>
      )}
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
        <p className="text-sm text-muted">
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
          className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-ink transition hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <Images size={20} weight="regular" aria-hidden="true" />
          See the full gallery
          <ArrowRight size={16} weight="regular" aria-hidden="true" />
        </Link>
      </Reveal>
    </div>
  );
}

function CommunityFooter() {
  return (
    <footer className="mt-16 border-t border-line pt-8 text-sm text-muted">
      <p>The Karter Cup · Chennai &amp; Coimbatore</p>
      <div className="mt-3 flex flex-wrap gap-4">
        <a
          href={INSTAGRAM_CUP}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-ink"
        >
          Instagram · @thekartercup
        </a>
        <a
          href={INSTAGRAM_CLUB}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-ink"
        >
          Instagram · @thekarterclub
        </a>
      </div>
    </footer>
  );
}

/** The Kartar CUP home page: a community/brand page. The quiz is demoted to a small, contextual
 * banner (see QuizBanner + quizGate) — never the hero's main CTA or its own headline section. */
export default function HomePage() {
  const s = useGuestSession();
  const [quizRevealed, setQuizRevealed] = useState(false);

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
        <CommunityHero
          trackId={s.event?.raceId}
          onSeeWhatsOn={() =>
            document
              .getElementById("events")
              ?.scrollIntoView({ behavior: "smooth", block: "start" })
          }
        />
        <CheckerDivider />
        <AboutSection />
        <PlainDivider />
        <UpcomingEventsSection
          event={s.event}
          status={s.status}
          quizRevealed={quizRevealed}
          onReveal={() => setQuizRevealed(true)}
        />
        <PlainDivider />
        <JoinCommunitySection whatsappUrl={s.event?.whatsappUrl} />
        <CheckerDivider />
        <GallerySection />
        <PlainDivider />
        <PartnershipsSection />
        <CommunityFooter />
      </Shell>
    </>
  );
}
