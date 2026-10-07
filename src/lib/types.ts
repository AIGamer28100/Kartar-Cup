import type { Timestamp } from 'firebase/firestore';

export type QuestionId = string;
export const DEFAULT_QUESTION_IDS: QuestionId[] = ['q1', 'q2', 'q3', 'q4', 'q5'];
export type Answers = Record<string, string>; // option id per question
export type Results = Record<string, string[]>; // multiple accepted ids; [] = voided
export type EventStatus = 'open' | 'locked' | 'scored';
export type Provider = 'google';
export interface EventDoc {
  status: EventStatus;
  lightsOutUtc: Timestamp;
  winnerRevealed: boolean;
  tiebreakOverride: string | null;
}
export interface ResultsDoc {
  answers: Results;
  source: string;
  updatedAt: Timestamp;
}
export interface Entry {
  uid: string;
  name: string;
  email?: string;
  phone?: string;
  photoURL?: string;
  provider: Provider;
  answers: Answers;
  submittedAt: Timestamp;
  createdAt: Timestamp;
}
export interface ScorableEntry {
  uid: string;
  name: string;
  photoURL?: string;
  answers: Answers;
  submittedAtMs: number;
}

/* ---------- big-screen podium reveal (PD1) ---------- */

export type ScreenMode = 'lobby' | 'standings' | 'podium';
export interface ScreenState {
  mode: ScreenMode;
  stage: 0 | 1 | 2 | 3;
  overrideUid: string | null;
  updatedAt: Timestamp;
}
export interface RankedRow extends ScorableEntry {
  /** Total = quiz points + Play-card bonus (R46). */
  score: number;
  /** Points from correct picks alone; absent on rows built without card data. */
  quizScore?: number;
  /** Play-card points added to the total (R46); 0 or absent when the guest has no card. */
  bonus?: number;
  ticks: Record<string, boolean>;
  rank: number;
  tiedOnScore: boolean;
}
export type Override = 'none' | 'open' | 'closed';
export type DerivedStatus = 'scheduled' | 'open' | 'closed' | 'scored';
export interface TeamCfg {
  id: string;
  label: string;
}
export interface DriverCfg {
  id: string;
  label: string;
  teamId: string;
  grid: number;
}
export type QuestionKind = 'team' | 'driver' | 'yesno';
export const YESNO_OPTIONS: Option[] = [
  { id: 'yes', label: 'Yes' },
  { id: 'no', label: 'No' },
];
export const MAX_QUESTION_POINTS = 10;
export interface QuestionCfg {
  id: string;
  prompt: string;
  kind: QuestionKind;
  hint?: string;
  /** Positive integer 1..MAX_QUESTION_POINTS; absent means 1 (the original scoring). */
  points?: number;
}
export interface EventConfig {
  id: string;
  raceId: string; // calendar id or 'custom'
  name: string;
  subtitle: string;
  circuit: string | null;
  themeId: string;
  raceStartUtc: Timestamp;
  raceDurationMin: number;
  opensAt: Timestamp;
  closesAt: Timestamp;
  override: Override;
  whatsappUrl: string;
  teams: TeamCfg[];
  drivers: DriverCfg[];
  questions: QuestionCfg[];
  questionIds: string[];
  nextQuestionSeq?: number; // monotonic; ids are never reissued
  winnerRevealed: boolean;
  tiebreakOverride: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
export interface Option {
  id: string;
  label: string;
  sub?: string; // team / grid slot
}
export interface Question {
  id: string;
  prompt: string;
  kind: QuestionKind;
  hint?: string;
  points?: number;
}

/* ---------- booking/ticketing (R23) ---------- */

export interface Venue {
  id: string;
  name: string;
  city: string;
  mapUrl?: string;
  capacityDefault?: number;
  /** Google Places place_id for exact location linking. */
  place_id?: string;
}
export interface PriceTier {
  id: string;
  label: string;
  priceInr: number;
  perTicketDiscountPct?: number;
  /** Maximum seats this tier can sell. 0 = unlimited (subject to event capacity). */
  capacity?: number;
  /** How many seats one ticket consumes. 1 = standard, 2 = "ticket for 2 entries", etc. */
  seatsPerTicket?: number;
}
export type DiscountKind = 'percent' | 'flat' | 'group' | 'earlybird';
export interface Discount {
  id: string;
  code?: string;
  label: string;
  kind: DiscountKind;
  value: number;
  minQty?: number;
  validFromUtc?: Timestamp;
  validToUtc?: Timestamp;
  maxRedemptions?: number;
  redeemed?: number;
  active: boolean;
}
/** R50: which section of /events an event belongs to. Missing on legacy docs = 'f1'. */
export type EventCategory = 'f1' | 'cup' | 'club';
/** A ticketed watch party. Own collection `bookingEvents/{id}`, separate from the quiz `events/{id}`;
 * may optionally reference a calendar race via raceId but is not required to. */
export interface BookingEvent {
  id: string;
  raceId?: string;
  title: string;
  venue: Venue;
  dateUtc: string;
  tiers: PriceTier[];
  discounts: Discount[];
  capacity: number;
  bookedCount: number;
  /** Id of the booking whose cancellation last released seats; the rules require it on every seat release. */
  lastReleaseBookingId?: string;
  salesOpen: boolean;
  /** R50: events-page section. Absent on legacy docs, which read as 'f1'. */
  category?: EventCategory;
  /** R47/R49: the host runs this event, so it is publicly listed even while sales are closed (then it
   * reads "booking opening soon"). Absent on legacy docs, which are listed only while sales are open. */
  hosted?: boolean;
  /** Optional free-form blurb (used by non-F1 events, which have no calendar race to describe them). */
  description?: string;
  /** Host-written cancellation/refund wording shown before and after purchase. */
  policy?: string;
  /** R45: print spec of this event's physical cards. */
  cardSpec?: CardSpec;
  /** R45: highest VIP pass number handed out so far (the next pass is cardSeq + 1). */
  cardSeq?: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
export type BookingStatus = 'reserved' | 'paid_mock' | 'checked_in' | 'cancelled';
/** qrToken == booking id; contains NO PII (R23). */
export interface Booking {
  id: string;
  bookingEventId: string;
  buyerUid: string;
  buyerName: string;
  buyerEmail: string;
  tierId: string;
  /** Position of the tier in the event's `tiers` when booked; firestore.rules check price against it. */
  tierIndex?: number;
  /** Position of the applied discount in the event's `discounts` (set with discountCode). */
  discountIndex?: number;
  qty: number;
  /** How many seats one ticket consumes. 1 = standard, 2 = "ticket for 2 entries", etc. */
  seatsPerTicket?: number;
  /** How many seats have been checked in so far (for bundled tickets). */
  checkedInCount?: number;
  unitPriceInr: number;
  discountCode?: string;
  discountAmountInr: number;
  totalInr: number;
  status: BookingStatus;
  qrToken: string;
  createdAt: Timestamp;
  paidAt?: Timestamp;
  checkedInAt?: Timestamp;
  checkedInBy?: string;
  cancelledAt?: Timestamp;
  cancelledBy?: 'host';
  cancelReason?: string;
  /** Mock payments only (R23): 'mock_refunded' = a paid_mock booking was cancelled; no real money moved. */
  refund?: 'mock_refunded' | 'none';
  /** R45: the VIP pass number, assigned by the host at check-in (per event, counting up from 1). */
  passNumber?: number;
  /** R45: a snapshot copy of the Play card this guest drew, written by the host (R15: only the owner reads it). */
  playCard?: PlayCardSnapshot;
}

/** R45/R46: one physical card design for an event. VIP = the pass; play = one driver with a points value. */
export type CardKind = 'vip' | 'play';
export interface CardDoc {
  id: string;
  kind: CardKind;
  title?: string;
  driverName?: string;
  /** Three-letter timing code, e.g. LEC. */
  code?: string;
  number?: number;
  /** Points the card adds to the holder's quiz score (R46). Play cards only. */
  points?: number;
  /** Inline compressed image (data URL) - used when no CDN link is given. */
  image?: string;
  /** https link to the design on a CDN (e.g. Cloudflare R2); preferred when present. */
  imageUrl?: string;
  width?: number;
  height?: number;
  order: number;
  updatedAt?: Timestamp;
}
export interface PlayCardSnapshot {
  cardId: string;
  driverName: string;
  code?: string;
  number?: number;
  points: number;
  image?: string;
  imageUrl?: string;
}
/** Physical card print spec for an event; sizes and designs differ race to race (R45). */
export interface CardSpec {
  widthMm?: number;
  heightMm?: number;
  note?: string;
}
