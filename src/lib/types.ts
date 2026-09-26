import type { Timestamp } from 'firebase/firestore';

export type QuestionId = 'q1' | 'q2' | 'q3' | 'q4' | 'q5';
export const QUESTION_IDS: QuestionId[] = ['q1', 'q2', 'q3', 'q4', 'q5'];
export type Answers = Record<QuestionId, string>; // option id per question
export type Results = Record<QuestionId, string[]>; // multiple accepted ids; [] = voided
export type EventStatus = 'open' | 'locked' | 'scored';
export type Provider = 'google' | 'anonymous';
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
  provider: Provider;
  answers: Answers;
  submittedAt: Timestamp;
  createdAt: Timestamp;
}
export interface ScorableEntry {
  uid: string;
  name: string;
  answers: Answers;
  submittedAtMs: number;
}
export interface RankedRow extends ScorableEntry {
  score: number;
  ticks: Record<QuestionId, boolean>;
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
  id: QuestionId;
  prompt: string;
  kind: 'team' | 'driver';
  hint?: string;
}
