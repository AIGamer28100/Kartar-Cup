import { Timestamp } from 'firebase/firestore';
import { buildDefaultEvent, type GridStatus } from '../../config/event';
import { ALL_RACES, type RaceInfo } from '../../config/calendar';
import { MAX_QUESTION_POINTS } from '../../lib/types';
import type { DriverCfg, EventConfig, Override, QuestionCfg, TeamCfg } from '../../lib/types';
import {
  QUIZ_CLOSE_FRACTION,
  QUIZ_MAX_LAPS,
  QUIZ_MAX_RACE_MIN,
  QUIZ_MIN_RACE_MIN,
  QUIZ_OPENS_BEFORE_MIN,
  clampQuizWindow,
  closeLap,
  quizEarliestOpenMs,
  quizLatestCloseMs,
} from '../../lib/quizWindow';
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
  totalLaps: string; // '' = unknown, the clock backstop alone closes the quiz
  /** Actual lights out recorded by the live controls (read-only here; after it the live controls own the window). */
  raceStartedAtMs: number | null;
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
  const defOpen = quizEarliestOpenMs(startMs);
  const defClose = quizLatestCloseMs(startMs, c.raceDurationMin);
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
    totalLaps: c.totalLaps ? String(c.totalLaps) : '',
    raceStartedAtMs: c.raceStartedAt ? c.raceStartedAt.toMillis() : null,
    opensOverride: c.opensAt.toMillis() === defOpen ? '' : toLocalInput(c.opensAt.toMillis()),
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
    totalLaps: '',
    gridStatus: { kind: 'no-data' },
  };
}

export interface Computed {
  startMs: number;
  durationMin: number;
  autoOpensMs: number;
  autoClosesMs: number;
  /** Effective window: the host's later-open / earlier-close, clamped to the 10 min / 30% bounds. */
  opensMs: number;
  closesMs: number;
  /** Why the clamp moved a host value (empty when nothing moved). */
  notes: string[];
  totalLaps: number | null;
  closeLap: number | null;
}

export function compute(f: FormState): Computed {
  const startMs = fromLocalInput(f.start);
  const durationMin = Number(f.duration);
  const autoOpensMs = quizEarliestOpenMs(startMs);
  const autoClosesMs = quizLatestCloseMs(startMs, durationMin);
  const o = fromLocalInput(f.opensOverride);
  const c = fromLocalInput(f.closesOverride);
  const w = Number.isFinite(autoClosesMs)
    ? clampQuizWindow(startMs, durationMin, Number.isNaN(o) ? autoOpensMs : o, Number.isNaN(c) ? autoClosesMs : c)
    : { opensMs: NaN, closesMs: NaN, notes: [] };
  const laps = Number(f.totalLaps);
  const totalLaps = f.totalLaps.trim() !== '' && Number.isInteger(laps) && laps >= 1 && laps <= QUIZ_MAX_LAPS ? laps : null;
  return {
    startMs,
    durationMin,
    autoOpensMs,
    autoClosesMs,
    opensMs: w.opensMs,
    closesMs: w.closesMs,
    notes: w.notes,
    totalLaps,
    closeLap: totalLaps === null ? null : closeLap(totalLaps),
  };
}

const istTime = (ms: number) =>
  Number.isFinite(ms)
    ? new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(ms)
    : '--';

/** One-line plain summary of when the quiz opens and closes, for the Details tab. */
export function quizWindowSummary(c: Computed): string {
  const opens =
    c.opensMs === c.autoOpensMs
      ? `Opens ${QUIZ_OPENS_BEFORE_MIN} min before lights out, ${istTime(c.opensMs)} IST`
      : `Opens ${istTime(c.opensMs)} IST`;
  const pct = `${Math.round(QUIZ_CLOSE_FRACTION * 100)}% of the race`;
  const clock = c.closesMs === c.autoClosesMs ? pct : `${istTime(c.closesMs)} IST`;
  const closes =
    c.totalLaps !== null && c.closeLap !== null
      ? `closes at lap ${c.closeLap} of ${c.totalLaps} or ${clock}, whichever comes first`
      : `closes at ${clock}${clock === pct ? ` (${istTime(c.closesMs)} IST)` : ''}`;
  return `${opens}; ${closes}`;
}

export type Errors = Partial<
  Record<'name' | 'subtitle' | 'circuit' | 'start' | 'duration' | 'totalLaps' | 'window' | 'whatsapp' | 'drivers' | 'teams' | 'questions', string>
>;

export function validate(f: FormState): Errors {
  const e: Errors = {};
  const c = compute(f);
  if (!f.name.trim()) e.name = 'Give the event a name.';
  else if (f.name.length > 80) e.name = 'Keep the name to 80 characters.';
  if (f.subtitle.length > 120) e.subtitle = 'Keep the subtitle to 120 characters.';
  if (f.circuit.length > 80) e.circuit = 'Keep the circuit to 80 characters.';
  if (Number.isNaN(c.startMs)) e.start = 'Pick a race start date and time.';
  if (!Number.isInteger(c.durationMin) || c.durationMin < QUIZ_MIN_RACE_MIN || c.durationMin > QUIZ_MAX_RACE_MIN)
    e.duration = `Enter whole minutes between ${QUIZ_MIN_RACE_MIN} and ${QUIZ_MAX_RACE_MIN}.`;
  if (f.totalLaps.trim() !== '' && c.totalLaps === null)
    e.totalLaps = `Enter whole laps between 1 and ${QUIZ_MAX_LAPS}, or leave empty.`;
  if (!e.start && !e.duration && !(c.closesMs > c.opensMs)) e.window = 'Quiz must close after it opens.';
  if (f.whatsapp !== '' && !WHATSAPP_RE.test(f.whatsapp))
    e.whatsapp = 'Use https://chat.whatsapp.com/... or https://whatsapp.com/channel/... , or leave empty.';
  if (f.teams.length > MAX_TEAMS || f.teams.some((t) => !t.label.trim()))
    e.teams = 'Every team needs a name (max 12 teams).';
  if (f.drivers.some((d) => !d.label.trim() || !f.teams.some((t) => t.id === d.teamId)))
    e.drivers = 'Every driver needs a label and a team.';
  if (f.questions.some((q) => q.prompt.length > 80 || (q.hint ?? '').length > 160))
    e.questions = 'Keep each prompt to 80 characters and each hint to 160.';
  else if (f.questions.length < 1 || f.questions.some((q) => !q.prompt.trim()))
    e.questions = 'Add at least one question; every question needs a prompt.';
  else if (f.questions.filter((q) => q.kind === 'card').length > 1)
    e.questions = 'Only one question can be the Play card question.';
  else if (f.questions.some((q) => q.points !== undefined && (!Number.isInteger(q.points) || q.points < 1 || q.points > MAX_QUESTION_POINTS)))
    e.questions = `Points per question must be a whole number from 1 to ${MAX_QUESTION_POINTS}.`;
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
    ...(c.totalLaps !== null ? { totalLaps: c.totalLaps } : {}),
    whatsappUrl: f.whatsapp,
    teams: f.teams,
    drivers: f.drivers.map((d, i) => ({ ...d, grid: i + 1 })),
    questions: f.questions.map((q) => {
      const { hint, points, ...rest } = q;
      // Default weight (1) is stored as absence so untouched events stay byte-identical.
      const base = points && points > 1 ? { ...rest, points } : rest;
      return hint?.trim() ? { ...base, hint: hint.trim() } : base;
    }),
    questionIds: f.questions.map((q) => q.id),
    nextQuestionSeq: Math.max(f.qCounter, ...f.questions.map((q) => qNum(q.id))) + 1,
    winnerRevealed: f.winnerRevealed,
    tiebreakOverride: f.tiebreakOverride,
    createdAt: Timestamp.fromMillis(f.createdAtMs),
    updatedAt: Timestamp.now(),
  };
}
