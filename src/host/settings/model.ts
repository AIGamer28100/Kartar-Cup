import { Timestamp } from 'firebase/firestore';
import { buildDefaultEvent, type GridStatus } from '../../config/event';
import { ALL_RACES, type RaceInfo } from '../../config/calendar';
import type { DriverCfg, EventConfig, Override, QuestionCfg, TeamCfg } from '../../lib/types';
import { fromLocalInput, toLocalInput } from './time';

export const MAX_QUESTIONS = 8;
export const MAX_TEAMS = 12;
export const WHATSAPP_RE =
  /^(https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9_-]{1,64}|https:\/\/whatsapp\.com\/channel\/[A-Za-z0-9_-]{1,64})$/;

export interface FormState {
  id: string;
  raceId: string; // calendar id or 'custom'
  themeId: string;
  override: Override;
  winnerRevealed: boolean;
  tiebreakOverride: string | null;
  createdAtMs: number;
  name: string;
  subtitle: string;
  circuit: string;
  start: string; // datetime-local
  duration: string;
  opensOverride: string;
  closesOverride: string;
  whatsapp: string;
  teams: TeamCfg[];
  drivers: Omit<DriverCfg, 'grid'>[];
  questions: QuestionCfg[];
  qCounter: number; // highest question number ever issued
  gridStatus: GridStatus; // R30: provenance of teams/drivers, for the settings banner (not persisted)
}

const qNum = (id: string) => Number(/^q(\d+)$/.exec(id)?.[1] ?? 0);

export function configToForm(c: EventConfig, gridStatus: GridStatus = { kind: 'saved' }): FormState {
  const startMs = c.raceStartUtc.toMillis();
  const defClose = startMs + Math.round(0.9 * c.raceDurationMin * 60_000);
  return {
    id: c.id,
    raceId: c.raceId,
    themeId: c.themeId,
    override: c.override,
    winnerRevealed: c.winnerRevealed,
    tiebreakOverride: c.tiebreakOverride,
    createdAtMs: c.createdAt.toMillis(),
    name: c.name,
    subtitle: c.subtitle,
    circuit: c.circuit ?? '',
    start: toLocalInput(startMs),
    duration: String(c.raceDurationMin),
    opensOverride: c.opensAt.toMillis() === startMs ? '' : toLocalInput(c.opensAt.toMillis()),
    closesOverride: c.closesAt.toMillis() === defClose ? '' : toLocalInput(c.closesAt.toMillis()),
    whatsapp: c.whatsappUrl,
    teams: c.teams.map((t) => ({ ...t })),
    drivers: [...c.drivers].sort((a, b) => a.grid - b.grid).map(({ id, label, teamId }) => ({ id, label, teamId })),
    questions: c.questions.map((q) => ({ ...q })),
    qCounter: Math.max(c.nextQuestionSeq ?? 1, 1 + Math.max(0, ...c.questions.map((q) => qNum(q.id)))) - 1,
    gridStatus,
  };
}

export async function raceToForm(race: RaceInfo): Promise<FormState> {
  const { config, gridStatus } = await buildDefaultEvent(race);
  return configToForm(config, gridStatus);
}

export async function customForm(): Promise<FormState> {
  const base = await raceToForm(ALL_RACES[0]);
  return {
    ...base,
    id: `custom-${Date.now().toString(36)}`,
    raceId: 'custom',
    themeId: ALL_RACES[0].themeId,
    name: '',
    circuit: '',
    gridStatus: { kind: 'no-data' },
  };
}

export interface Computed {
  startMs: number;
  durationMin: number;
  autoOpensMs: number;
  autoClosesMs: number;
  opensMs: number;
  closesMs: number;
}

export function compute(f: FormState): Computed {
  const startMs = fromLocalInput(f.start);
  const durationMin = Number(f.duration);
  const autoOpensMs = startMs;
  const autoClosesMs = startMs + Math.round(0.9 * durationMin * 60_000);
  const o = fromLocalInput(f.opensOverride);
  const c = fromLocalInput(f.closesOverride);
  return {
    startMs,
    durationMin,
    autoOpensMs,
    autoClosesMs,
    opensMs: Number.isNaN(o) ? autoOpensMs : o,
    closesMs: Number.isNaN(c) ? autoClosesMs : c,
  };
}

export type Errors = Partial<
  Record<'name' | 'subtitle' | 'circuit' | 'start' | 'duration' | 'window' | 'whatsapp' | 'drivers' | 'teams' | 'questions', string>
>;

export function validate(f: FormState): Errors {
  const e: Errors = {};
  const c = compute(f);
  if (!f.name.trim()) e.name = 'Give the event a name.';
  else if (f.name.length > 80) e.name = 'Keep the name to 80 characters.';
  if (f.subtitle.length > 120) e.subtitle = 'Keep the subtitle to 120 characters.';
  if (f.circuit.length > 80) e.circuit = 'Keep the circuit to 80 characters.';
  if (Number.isNaN(c.startMs)) e.start = 'Pick a race start date and time.';
  if (!Number.isInteger(c.durationMin) || c.durationMin < 10 || c.durationMin > 600)
    e.duration = 'Enter whole minutes between 10 and 600.';
  if (!e.start && !e.duration && !(c.closesMs > c.opensMs)) e.window = 'Quiz must close after it opens.';
  if (f.whatsapp !== '' && !WHATSAPP_RE.test(f.whatsapp))
    e.whatsapp = 'Use https://chat.whatsapp.com/... or https://whatsapp.com/channel/... , or leave empty.';
  if (f.teams.length > MAX_TEAMS || f.teams.some((t) => !t.label.trim()))
    e.teams = 'Every team needs a name (max 12 teams).';
  if (f.drivers.some((d) => !d.label.trim() || !f.teams.some((t) => t.id === d.teamId)))
    e.drivers = 'Every driver needs a label and a team.';
  if (f.questions.length < 1 || f.questions.some((q) => !q.prompt.trim()))
    e.questions = 'Add at least one question; every question needs a prompt.';
  return e;
}

export function formToConfig(f: FormState): EventConfig {
  const c = compute(f);
  return {
    id: f.id,
    raceId: f.raceId,
    name: f.name.trim(),
    subtitle: f.subtitle.trim(),
    circuit: f.circuit.trim() || null,
    themeId: f.themeId,
    raceStartUtc: Timestamp.fromMillis(c.startMs),
    raceDurationMin: c.durationMin,
    opensAt: Timestamp.fromMillis(c.opensMs),
    closesAt: Timestamp.fromMillis(c.closesMs),
    override: f.override,
    whatsappUrl: f.whatsapp,
    teams: f.teams,
    drivers: f.drivers.map((d, i) => ({ ...d, grid: i + 1 })),
    questions: f.questions.map((q) => {
      const { hint, ...rest } = q;
      return hint?.trim() ? { ...rest, hint: hint.trim() } : rest;
    }),
    questionIds: f.questions.map((q) => q.id),
    nextQuestionSeq: Math.max(f.qCounter, ...f.questions.map((q) => qNum(q.id))) + 1,
    winnerRevealed: f.winnerRevealed,
    tiebreakOverride: f.tiebreakOverride,
    createdAt: Timestamp.fromMillis(f.createdAtMs),
    updatedAt: Timestamp.now(),
  };
}
