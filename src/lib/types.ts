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
  score: number;
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
export interface QuestionCfg {
  id: string;
  prompt: string;
  kind: 'team' | 'driver';
  hint?: string;
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
  kind: 'team' | 'driver';
  hint?: string;
}

/* ---------- booking/ticketing (R23) ---------- */

export interface Venue {
  id: string;
  name: string;
  city: string;
  mapUrl?: string;
  capacityDefault?: number;
}
export interface PriceTier {
  id: string;
  label: string;
  priceInr: number;
  perTicketDiscountPct?: number;
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
  salesOpen: boolean;
  /** Host-written cancellation/refund wording shown before and after purchase. */
  policy?: string;
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
  qty: number;
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
}
