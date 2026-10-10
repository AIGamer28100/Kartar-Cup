/**
 * Typed, deterministic app-level fixtures for the Mock Lab (events, entries, rankings, bookings, cards).
 * Built from the captured Malaysia payloads in ./net, never hand-typed numbers (R17). Every factory is
 * pure: a seeded PRNG and a fixed BASE_MS, so two calls with no args deep-equal and tests can assert on them.
 */
import { Timestamp } from 'firebase/firestore';
import { normalizeDrivers, slug } from '../../lib/openf1';
import type { OpenF1Driver } from '../../lib/openf1';
import { cardBonusByUid, maxScore, pointsMap, rankEntries } from '../../lib/scoring';
import { googleMapsPinUrl } from '../../lib/placeSearch';
import type {
  Booking,
  BookingEvent,
  CardDoc,
  Entry,
  EventConfig,
  PlayCardSnapshot,
  QuestionCfg,
  RankedRow,
  Results,
  ScreenState,
} from '../../lib/types';
import driversRace from './net/drivers.race.json';
import lapsRace from './net/laps.race.json';
import resultQuali from './net/session_result.quali.json';
import resultRace from './net/session_result.race.json';
import placesAutocomplete from './net/places.autocomplete.json';
import placesDetails from './net/places.details.json';

/** Race start of the captured Malaysia weekend (race session date_start). */
export const BASE_MS = Date.UTC(2026, 9, 4, 7, 0, 0);
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export function ts(ms: number): Timestamp {
  return Timestamp.fromMillis(ms);
}

/** Tiny seeded PRNG (mulberry32): same seed, same sequence. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- the real Malaysia grid ---------- */

const rawDrivers = driversRace as unknown as (OpenF1Driver & { name_acronym: string })[];
const grid = normalizeDrivers(rawDrivers);
const byNumber = new Map(rawDrivers.map((d) => [d.driver_number, d]));
const driverId = (n: number): string | null => {
  const d = byNumber.get(n);
  return d?.full_name ? slug(d.full_name) : null;
};
const teamId = (n: number): string => slug(byNumber.get(n)?.team_name ?? '');

const QUESTIONS: QuestionCfg[] = [
  { id: 'q1', kind: 'team', prompt: 'Which constructor has the SLOWEST pit stop?' },
  { id: 'q2', kind: 'driver', prompt: 'Which driver makes the MOST overtakes?' },
  { id: 'q3', kind: 'driver', prompt: 'Which driver will DNF?' },
  { id: 'q4', kind: 'team', prompt: 'Which constructor has the FASTEST pit stop?' },
  { id: 'q5', kind: 'driver', prompt: 'Which driver sets the FASTEST LAP?' },
];
const QUESTION_IDS = QUESTIONS.map((q) => q.id);

export const mockEventConfig = (over: Partial<EventConfig> = {}): EventConfig => ({
  id: 'mock-malaysia-2026',
  raceId: '2026-r16-malaysia',
  name: 'Malaysian Grand Prix',
  subtitle: 'Kartar CUP watch party',
  circuit: 'Sepang International Circuit',
  themeId: '2026-r16-malaysia',
  raceStartUtc: ts(BASE_MS),
  raceDurationMin: 110,
  opensAt: ts(BASE_MS - 7 * DAY),
  closesAt: ts(BASE_MS - HOUR),
  override: 'none',
  whatsappUrl: 'https://chat.whatsapp.com/mock-invite',
  teams: grid.teams.map((t) => ({ id: t.id, label: t.label })),
  drivers: grid.drivers.map((d) => ({ ...d })),
  questions: QUESTIONS.map((q) => ({ ...q })),
  questionIds: [...QUESTION_IDS],
  nextQuestionSeq: 6,
  winnerRevealed: false,
  tiebreakOverride: null,
  createdAt: ts(BASE_MS - 10 * DAY),
  updatedAt: ts(BASE_MS - 2 * DAY),
  ...over,
});

/* ---------- results derived from the captured race ---------- */

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

/** Ids whose score is the best (max or min) of the map; every tie is accepted. */
function best(scores: Map<string, number>, dir: 'max' | 'min'): string[] {
  const vals = [...scores.values()];
  if (!vals.length) return [];
  const target = dir === 'max' ? Math.max(...vals) : Math.min(...vals);
  return [...scores].filter(([, v]) => v === target).map(([k]) => k);
}

export const mockResults = (): Results => {
  const laps = lapsRace as { driver_number: number; lap_number: number; lap_duration: number | null; is_pit_out_lap: boolean }[];
  const timed = laps.filter((l) => typeof l.lap_duration === 'number');

  // Fastest lap: lowest lap_duration.
  const fastest = timed.reduce((a, b) => (b.lap_duration! < a.lap_duration! ? b : a));

  // DNF: every classified-out driver is accepted.
  const dnf = (resultRace as { driver_number: number; dnf: boolean }[])
    .filter((r) => r.dnf)
    .map((r) => driverId(r.driver_number))
    .filter((x): x is string => !!x);

  // Most overtakes: places gained from the qualifying order to the race finish.
  const quali = new Map((resultQuali as { driver_number: number; position: number | null }[]).map((r) => [r.driver_number, r.position]));
  const gains = new Map<string, number>();
  for (const r of resultRace as { driver_number: number; position: number | null }[]) {
    const id = driverId(r.driver_number);
    const start = quali.get(r.driver_number);
    if (id && r.position && start) gains.set(id, start - r.position);
  }

  // Pit stops are not in the captured set; proxy = how much slower a driver's out-laps are than their
  // own median lap, averaged per team. Real data, derived, not invented.
  const penalty = new Map<string, number[]>();
  for (const d of byNumber.keys()) {
    const mine = timed.filter((l) => l.driver_number === d);
    const med = median(mine.filter((l) => l.lap_number > 1 && !l.is_pit_out_lap).map((l) => l.lap_duration!));
    for (const l of mine.filter((l) => l.is_pit_out_lap && l.lap_number > 1)) {
      const t = teamId(d);
      penalty.set(t, [...(penalty.get(t) ?? []), l.lap_duration! - med]);
    }
  }
  const teamPit = new Map([...penalty].map(([t, xs]) => [t, xs.reduce((a, b) => a + b, 0) / xs.length]));

  return {
    q1: best(teamPit, 'max'),
    q2: best(gains, 'max'),
    q3: dnf,
    q4: best(teamPit, 'min'),
    q5: [driverId(fastest.driver_number)!],
  };
};

/* ---------- entries and ranking ---------- */

const NAMES = [
  'Aarav Menon', 'Diya Raman', 'Karthik Subbu', 'Meera Iyer', 'Rohan Das', 'Ananya Pillai',
  'Vikram Rao', 'Sneha Nair', 'Arjun Kumar', 'Priya Natarajan', 'Harish Babu', 'Lakshmi Venkat',
  'Naveen Raj', 'Ishita Shah', 'Surya Prakash', 'Kavya Reddy', 'Dev Malhotra', 'Tara Joseph',
  'Imran Sheikh', 'Nisha Thomas', 'Gokul Ram', 'Zoya Khan', 'Bharath Kannan', 'Revathi Sundar',
];
/** Correct-answer counts for the first guests: forces exact ties (3,3 / 2,2,2) and a visible spread. */
const CORRECT_PATTERN = [4, 3, 3, 2, 2, 2, 1, 1, 1, 0, 0, 5];
/** Guests (by index) who hold a Play card, and its points (R46). Lifts idx 3 and 6 onto the 3-point tie. */
const CARD_HOLDERS: Record<number, number> = { 3: 1, 6: 2 };

const uidOf = (i: number): string => `mock-uid-${String(i + 1).padStart(2, '0')}`;

export const mockEntries = (n = 12): Entry[] => {
  const rng = mulberry32(0xca7);
  const results = mockResults();
  const cfg = mockEventConfig();
  const optionsFor = (q: QuestionCfg): string[] => (q.kind === 'team' ? cfg.teams : cfg.drivers).map((o) => o.id);
  return Array.from({ length: n }, (_, i) => {
    const want = CORRECT_PATTERN[i] ?? Math.floor(rng() * 4);
    const order = [...QUESTIONS].sort(() => rng() - 0.5);
    const correct = new Set(order.slice(0, want).map((q) => q.id));
    const answers: Record<string, string> = {};
    for (const q of QUESTIONS) {
      const opts = optionsFor(q);
      const accepted = results[q.id];
      if (correct.has(q.id)) {
        answers[q.id] = accepted[Math.floor(rng() * accepted.length)];
      } else {
        const wrong = opts.filter((o) => !accepted.includes(o));
        answers[q.id] = wrong[Math.floor(rng() * wrong.length)];
      }
    }
    const name = NAMES[i % NAMES.length] + (i >= NAMES.length ? ` ${Math.floor(i / NAMES.length) + 1}` : '');
    const at = BASE_MS - 3 * DAY + i * 61_000 + Math.floor(rng() * 30_000);
    return {
      uid: uidOf(i),
      name,
      email: `${slug(name)}@example.test`,
      provider: 'google',
      answers,
      submittedAt: ts(at),
      createdAt: ts(at - 5 * MIN),
    };
  });
};

export const mockRanked = (n = 12): RankedRow[] => {
  const cfg = mockEventConfig();
  const bookings = Object.entries(CARD_HOLDERS)
    .filter(([i]) => Number(i) < n)
    .map(([i, points]) => mockBooking({ buyerUid: uidOf(Number(i)), playCard: { ...mockPlayCard(), points } }));
  const bonus = cardBonusByUid(bookings, new Set([mockBookingEvent().id]));
  const scorable = mockEntries(n).map((e) => ({
    uid: e.uid,
    name: e.name,
    photoURL: e.photoURL,
    answers: e.answers,
    submittedAtMs: e.submittedAt.toMillis(),
  }));
  return rankEntries(scorable, mockResults(), null, cfg.questionIds, pointsMap(cfg.questions), bonus);
};

/** Highest possible score for the mock quiz (exported for tests and harness labels). */
export const mockMaxScore = (): number => maxScore(QUESTIONS);

export const mockScreenState = (over: Partial<ScreenState> = {}): ScreenState => ({
  mode: 'lobby',
  stage: 0,
  overrideUid: null,
  updatedAt: ts(BASE_MS),
  ...over,
});

/* ---------- bookings and cards ---------- */

const venuePrediction = placesAutocomplete.predictions[0];
const venuePoint = placesDetails.result.geometry.location;

export const mockBookingEvent = (over: Partial<BookingEvent> = {}): BookingEvent => ({
  id: 'mock-booking-event',
  raceId: '2026-r16-malaysia',
  title: 'Malaysian GP watch party',
  venue: {
    id: 'mock-venue',
    name: venuePrediction.structured_formatting.main_text,
    city: 'Chennai',
    mapUrl: googleMapsPinUrl(venuePoint),
    capacityDefault: 120,
    place_id: venuePrediction.place_id,
  },
  dateUtc: new Date(BASE_MS).toISOString(),
  tiers: [
    { id: 'general', label: 'General entry', priceInr: 599, seatsPerTicket: 1 },
    { id: 'couple', label: 'Couple pass (2 entries)', priceInr: 999, seatsPerTicket: 2 },
    { id: 'paddock', label: 'Paddock club', priceInr: 1499, capacity: 12, seatsPerTicket: 1 },
  ],
  discounts: [
    { id: 'd-percent', code: 'RACE10', label: '10% off', kind: 'percent', value: 10, active: true },
    { id: 'd-flat', code: 'FLAT100', label: 'Rs 100 off', kind: 'flat', value: 100, active: true },
    { id: 'd-group', code: 'GROUP4', label: 'Group of 4+: 15% off', kind: 'group', value: 15, minQty: 4, active: true },
    {
      id: 'd-early',
      code: 'EARLY',
      label: 'Early bird: 20% off',
      kind: 'earlybird',
      value: 20,
      validFromUtc: ts(BASE_MS - 30 * DAY),
      validToUtc: ts(BASE_MS - 14 * DAY),
      active: true,
    },
  ],
  capacity: 120,
  bookedCount: 55, // 31 general + 6 couple (x2 seats) + 12 paddock
  salesOpen: true,
  category: 'f1',
  hosted: true,
  description: 'Big-screen race, live quiz and a Play card for every table.',
  policy: 'Cancel up to 24 hours before the race for a full refund.',
  cardSeq: 0,
  createdAt: ts(BASE_MS - 20 * DAY),
  updatedAt: ts(BASE_MS - 2 * DAY),
  ...over,
});

export const mockBooking = (over: Partial<Booking> = {}): Booking => {
  const rng = mulberry32(0xb00c);
  const qrToken = Array.from({ length: 32 }, () => Math.floor(rng() * 16).toString(16)).join('');
  return {
    id: 'mock-booking-1',
    bookingEventId: 'mock-booking-event',
    buyerUid: uidOf(0),
    buyerName: NAMES[0],
    buyerEmail: `${slug(NAMES[0])}@example.test`,
    tierId: 'general',
    tierIndex: 0,
    qty: 2,
    seatsPerTicket: 1,
    unitPriceInr: 599,
    discountAmountInr: 0,
    totalInr: 1198,
    status: 'paid_mock',
    qrToken,
    createdAt: ts(BASE_MS - 4 * DAY),
    paidAt: ts(BASE_MS - 4 * DAY + 2 * MIN),
    ...over,
  };
};

export const mockCards = (): CardDoc[] => {
  const picks = [1, 3, 44, 16].map((n) => byNumber.get(n)).filter((d): d is NonNullable<typeof d> => !!d);
  const points = [3, 2, 2, 1];
  const vip: CardDoc = { id: 'card-vip', kind: 'vip', title: 'VIP pass', order: 0, width: 856, height: 540, updatedAt: ts(BASE_MS - DAY) };
  const play = picks.map<CardDoc>((d, i) => ({
    id: `card-play-${d.name_acronym}`,
    kind: 'play',
    driverName: d.full_name,
    code: d.name_acronym,
    number: d.driver_number,
    points: points[i],
    order: i + 1,
    width: 856,
    height: 540,
    updatedAt: ts(BASE_MS - DAY),
  }));
  return [vip, ...play];
};

export const mockPlayCard = (): PlayCardSnapshot => {
  const c = mockCards()[1];
  return { cardId: c.id, driverName: c.driverName!, code: c.code, number: c.number, points: c.points! };
};

/** Tickets sold per tier id (what watchTierCounts returns); paddock is at its capacity of 12. */
export const mockTierCounts = (): Record<string, number> => ({ general: 31, couple: 6, paddock: 12 });

