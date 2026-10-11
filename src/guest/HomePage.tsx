import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { DUR, EASE } from "../lib/motion";
import {
  ArrowRight,
  Images,
  CalendarBlank,
  InstagramLogo,
  WhatsappLogo,
} from "@phosphor-icons/react";
import { RaceStateBackdrop, RaceStateDisplay, type PodiumDriver, type RaceState } from "../components/RaceStateDisplay";
import { fetchPodiumForRace } from "../lib/podium";
import { computeRaceState } from "../lib/raceState";
import { raceStartFor } from "../lib/f1api";
import Divider from "../components/Divider";
import { buttonCls } from "../components/Button";
import Skeleton from "../components/Skeleton";
import TrackMap from "../components/TrackMap";
import { ALL_RACES, nextRace } from "../config/calendar";
import { trackForRace } from "../config/tracks";
import { GALLERY_PLACEHOLDERS, gallerySrc } from "./galleryData";
import { istReadout } from "./model";
import { useCommunityLink } from "../lib/useCommunityLink";
import { CardKerb, Eyebrow, H1, H2, Reveal, Shell } from "./parts";
import ChampionshipSection from "./Championship";
import { ScrollProgressPath, useDesktopMotion } from "./scrollFx";
import { KerbDraw, Magnetic, Stagger, StaggerItem, SplitWords } from "../components/motion";
import { nextSession } from "../lib/f1api";
import { useSchedule } from "../lib/useSchedule";
import { usePageMeta } from "../lib/pageMeta";
import { watchBookingEvents } from "../lib/bookings";
import type { BookingEvent } from "../lib/types";
import { nextHostedRace } from "./eventsModel";

const INSTAGRAM_CUP = "https://www.instagram.com/thekartercup/";
const INSTAGRAM_CLUB = "https://www.instagram.com/thekarterclub/";

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
  const reduce = useReducedMotion();
  return (
    <motion.div
      className="divider-checker my-16 w-full origin-left rounded-full md:my-24 lg:my-28"
      aria-hidden="true"
      initial={reduce ? false : { scaleX: 0 }}
      whileInView={{ scaleX: 1 }}
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
      transition={reduce ? { duration: 0 } : { duration: DUR.slow + 0.4, ease: EASE.launch }}
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
function HeroAndNextRace({ onRaceStateChange }: { onRaceStateChange: (state: RaceState | null) => void }) {
  // Ticks every 30s so the live flag state and the "next race" roll over without a reload.
  const [nowMs, setNowMs] = useState(() => Date.now());
  const next = useMemo(() => nextRace(new Date(nowMs), ALL_RACES), [nowMs]);
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  // R47: "next watch party" is the next HOSTED race, which can be later than the next race
  // on the calendar (e.g. Malaysia is not hosted, Singapore is). Until booking events load, or if
  // they fail to, nothing watch-party related is claimed.
  const [bookingEvents, setBookingEvents] = useState<BookingEvent[]>([]);
  useEffect(() => watchBookingEvents(setBookingEvents, () => setBookingEvents([])), []);
  const hostedNext = useMemo(() => nextHostedRace(new Date(nowMs), ALL_RACES, bookingEvents), [bookingEvents, nowMs]);
  const track = next ? trackForRace(next.id) : null;
  const { schedule, settled } = useSchedule(next?.season);
  const targetMs = next ? raceStartFor(next, schedule).ms : 0;

  // Compute race state for live flag display
  const raceStateInfo = useMemo(
    () => (next ? computeRaceState(targetMs, next.id, nowMs) : null),
    [next, targetMs, nowMs]
  );
  // The next watch party's lights-out from the real schedule of its own season (cached fetch).
  const { schedule: hostedSchedule } = useSchedule(hostedNext?.season);
  const hostedStart = hostedNext ? istReadout(raceStartFor(hostedNext, hostedSchedule).ms) : null;
  const raceState = raceStateInfo?.state ?? null;

  // Real podium (OpenF1) once the race has ended; cached per race, silent on failure (no podium).
  const [podium, setPodium] = useState<PodiumDriver[] | null>(null);
  const ended = raceStateInfo?.isEnded ?? false;
  useEffect(() => {
    if (!next || !ended) {
      setPodium(null);
      return;
    }
    let live = true;
    void fetchPodiumForRace(next).then((p) => live && setPodium(p));
    return () => {
      live = false;
    };
  }, [next, ended]);

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
        <Reveal kind="fade">
          <Eyebrow>Chennai &amp; Coimbatore · motorsport community</Eyebrow>
        </Reveal>
        <h1 className={`mt-4 ${H1}`}>
          <SplitWords text="The Karter Cup" delay={0.05} />
        </h1>
        <KerbDraw className="mt-5 h-[5px] w-20" delay={0.35} />
        <Reveal index={2}>
          <p className="mt-6 max-w-[40ch] text-lead text-pretty text-muted md:mt-7">
            A leisure go-karting league and F1-style motorsport community —
            karting days, sim racing and watch parties, run by people who
            actually turn up.
          </p>
        </Reveal>
        <Reveal index={3} className="mt-6">
          <Magnetic>
            <Link
              to="/events"
              className={buttonCls("secondary", "group/cta")}
            >
              See the full calendar
              <ArrowRight
                size={18}
                weight="regular"
                aria-hidden="true"
                className="transition-transform duration-200 group-hover/cta:translate-x-1 motion-reduce:transition-none"
              />
            </Link>
          </Magnetic>
        </Reveal>
      </div>

      {next && raceStateInfo && (
        <div
          ref={trackWrapRef}
          className="group relative flex flex-col justify-center gap-6 overflow-hidden rounded-lg border border-line px-5 py-8 transition-colors hover:border-accent lg:flex-row lg:items-center lg:gap-10 lg:px-8"
        >
          <div className="min-w-0 lg:flex-[3]">
            <Reveal index={1}>
              <p className="font-mono text-xs uppercase tracking-widest text-muted">
                Round {String(next.round).padStart(2, "0")} ·{" "}
                {hostedNext?.id === next.id ? "watch-party night" : "next race"}
              </p>
              <p className="mt-1 text-h3 text-balance font-medium text-ink">
                <Link
                  to={`/races/${next.id}`}
                  className="after:absolute after:inset-0 after:z-0 after:content-[''] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  {next.name}
                </Link>
              </p>
              <p className="mt-1 text-sm text-muted lg:text-[1rem]">
                {istReadout(targetMs).day} {istReadout(targetMs).month} ·{" "}
                {next.locality}, {next.country}
              </p>
              <p className="mt-2 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-accent-text">
                Open race
                <ArrowRight size={16} weight="regular" aria-hidden="true" className="transition-transform duration-150 group-hover:translate-x-1 motion-reduce:transition-none" />
              </p>
              {hostedNext && hostedNext.id !== next.id && (
                <Link
                  to={`/races/${hostedNext.id}`}
                  className={buttonCls("secondary", "press group/chip relative z-10 mt-3 min-h-11 w-fit text-sm")}
                >
                  <CalendarBlank size={16} weight="regular" aria-hidden="true" />
                  Next watch party: {hostedNext.name} · {hostedStart?.day} {hostedStart?.month}
                  <ArrowRight size={16} weight="regular" aria-hidden="true" className="transition-transform duration-150 group-hover/chip:translate-x-1 motion-reduce:transition-none" />
                </Link>
              )}
              {upNext && upNext.key !== "race" && (
                <p className="mt-2 flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted">
                  <span className="relative flex size-2" aria-hidden="true">
                    <span className="absolute inline-flex size-full rounded-full bg-info opacity-60 motion-safe:animate-ping" />
                    <span className="relative inline-flex size-2 rounded-full bg-info" />
                  </span>
                  Next on track: {upNext.label} · {istReadout(upNext.startMs).day}{" "}
                  {istReadout(upNext.startMs).month} {istReadout(upNext.startMs).time} IST
                </p>
              )}
            </Reveal>
            <Reveal index={2} className="mt-5">
              {settled ? (
                <RaceStateDisplay
                  state={raceStateInfo.state}
                  raceStartMs={targetMs}
                  drivers={podium ?? undefined}
                  align="start"
                  onDisplayStateChange={onRaceStateChange}
                />
              ) : (
                <div className="flex flex-col items-start gap-3" aria-busy="true">
                  <Skeleton variant="shimmer" className="h-6 w-28" />
                  <Skeleton variant="shimmer" className="h-10 w-64 max-w-full" />
                </div>
              )}
            </Reveal>
          </div>
          {track && (
            <Reveal index={3} className="min-w-0 lg:flex-[2]">
              <motion.div
                style={
                  desktopMotion ? { y: trackY, opacity: trackOpacity } : undefined
                }
              >
                <TrackMap track={track} state={raceState ?? undefined} animate className="mx-auto max-h-56 max-w-xs lg:max-h-64" />
              </motion.div>
            </Reveal>
          )}
          <CardKerb />
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

/** R32 follow-up: only the NEXT event, with its real circuit visualization and a live countdown —
 * the full schedule moved to its own page (/events), so this section stays a single, focused
 * "what's on next" moment rather than a 3-up list. */
function PartnershipsSection() {
  const slots = [
    "Title partner slot",
    "Venue partner slot",
    "Community partner slot",
  ];
  return (
    <div>
      <SectionHeading eyebrow="Partnerships">Collaborations</SectionHeading>
      <Stagger className="mt-6 grid gap-4 sm:grid-cols-3" step={0.09}>
        {slots.map((label, i) => (
          <StaggerItem
            key={label}
            kind="drs"
            className="group relative flex min-h-24 items-center justify-center overflow-hidden rounded-lg border border-dashed border-line text-center text-sm text-muted transition-colors duration-200 hover:border-muted hover:text-ink"
          >
            {/* pit-board slot number */}
            <span aria-hidden="true" className="absolute left-3 top-2 font-mono text-[0.625rem] tracking-widest text-muted/70">
              P{i + 1}
            </span>
            <span
              aria-hidden="true"
              className="absolute inset-x-0 bottom-0 h-[3px] origin-left scale-x-0 transition-transform duration-300 group-hover:scale-x-100 motion-reduce:transition-none"
              style={{ backgroundImage: "var(--kerb-stripes)" }}
            />
            {label}
          </StaggerItem>
        ))}
      </Stagger>
      <Reveal index={2} className="mt-4">
        <p className="text-[1rem] leading-relaxed text-pretty text-muted md:text-lg">
          Also exploring a sim-racing collaboration with racesims.in —
          exploratory only, not a confirmed partnership.
        </p>
      </Reveal>
    </div>
  );
}

const communityCardCls =
  "group press relative flex min-h-24 flex-col justify-between gap-3 overflow-hidden rounded-lg border border-line bg-raised p-5 text-ink transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

function CommunityCard({
  href,
  icon,
  title,
  note,
  primary = false,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  note: string;
  primary?: boolean;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`${communityCardCls} ${primary ? "border-accent" : ""}`}
    >
      <span className="flex items-center gap-3 text-[1rem] font-medium">
        {icon}
        {title}
        <ArrowRight size={16} weight="regular" aria-hidden="true" className="ml-auto shrink-0 transition-transform duration-150 group-hover:translate-x-1 motion-reduce:transition-none" />
      </span>
      <span className="text-sm text-muted">{note}</span>
      <CardKerb />
    </a>
  );
}

function JoinCommunitySection() {
  const wa = useCommunityLink();
  return (
    <div>
      <SectionHeading eyebrow="Join in">Join the community</SectionHeading>
      <Stagger className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <StaggerItem>
          {wa ? (
            <CommunityCard
              primary
              href={wa}
              icon={<WhatsappLogo size={24} weight="regular" aria-hidden="true" />}
              title="Join on WhatsApp"
              note="Event news and race-night chat"
            />
          ) : (
            <p className="flex min-h-24 items-center rounded-lg border border-dashed border-line p-5 text-sm text-muted">
              WhatsApp link not open yet — ask at the event.
            </p>
          )}
        </StaggerItem>
        <StaggerItem>
          <CommunityCard
            href={INSTAGRAM_CUP}
            icon={<InstagramLogo size={24} weight="regular" aria-hidden="true" />}
            title="@thekartercup"
            note="The league on Instagram"
          />
        </StaggerItem>
        <StaggerItem>
          <CommunityCard
            href={INSTAGRAM_CLUB}
            icon={<InstagramLogo size={24} weight="regular" aria-hidden="true" />}
            title="@thekarterclub"
            note="Our watch parties"
          />
        </StaggerItem>
      </Stagger>
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
      <Stagger className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {preview.map((g) => (
          <StaggerItem key={g.seed} kind="scale" className="group relative overflow-hidden rounded-lg border border-line bg-raised transition-colors hover:border-accent">
            <Link to="/gallery" aria-label={`Open gallery: ${g.caption}`} className="absolute inset-0 z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" />
            <img
              src={gallerySrc(g.seed, 320, 320)}
              alt={g.caption}
              loading="lazy"
              className="aspect-square w-full object-cover transition-transform duration-500 hover:scale-[1.05] motion-reduce:transition-none"
            />
          </StaggerItem>
        ))}
      </Stagger>
      <Reveal index={2} className="mt-5">
        <Magnetic>
          <Link to="/gallery" className={buttonCls("secondary", "press group w-fit")}>
            <Images size={20} weight="regular" aria-hidden="true" />
            See the full gallery
            <ArrowRight size={16} weight="regular" aria-hidden="true" className="transition-transform duration-150 group-hover:translate-x-1 motion-reduce:transition-none" />
          </Link>
        </Magnetic>
      </Reveal>
    </div>
  );
}

/** The Kartar CUP home page: a community/brand page. The quiz is not offered here; it lives behind
 * the host's /play link. */
export default function HomePage() {
  usePageMeta({});
  const [raceState, setRaceState] = useState<RaceState | null>(null);

  return (
    <>
      <ScrollProgressPath />
      {raceState && <RaceStateBackdrop state={raceState} className="fixed inset-0 z-0" />}
      <div className="relative z-10">
        <Shell>
          <HeroAndNextRace onRaceStateChange={setRaceState} />
          <CheckerDivider />
          <AboutSection />
          <PlainDivider />
          <ChampionshipSection season={nextRace(new Date(), ALL_RACES)?.season ?? 2026} />
          <PlainDivider />
          <JoinCommunitySection />
          <CheckerDivider />
          <GallerySection />
          <PlainDivider />
          <PartnershipsSection />
        </Shell>
      </div>
    </>
  );
}
