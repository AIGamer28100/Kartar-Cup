import { titleCaseName } from '../../lib/raceData';
import { slug as normalize } from '../../lib/openf1';
import { YESNO_OPTIONS, type EventConfig, type QuestionCfg } from '../../lib/types';

export type AnswerKind = QuestionCfg['kind'];

/** One tappable option on the answer grid / one resolved pick on "Your grid". */
export interface AnswerCard {
  id: string;
  kind: AnswerKind;
  label: string;
  /** Driver first name(s), small above the surname. */
  first: string;
  /** Surname (driver), team name, or Yes / No. */
  main: string;
  /** Team name under a driver. */
  sub: string;
  colour: string;
  headshotUrl: string | null;
  /** Three-letter code (driver), initials (team) or Y / N. */
  code: string;
  grid?: number;
}

const TEAM_COLOURS: Record<string, string> = {
  mercedes: '#00D7B6',
  ferrari: '#ED1131',
  mclaren: '#F47600',
  'red-bull': '#4781D7',
  alpine: '#00A1E8',
  haas: '#9C9FA2',
  'racing-bulls': '#6C98FF',
  williams: '#1868DB',
  audi: '#F50537',
  cadillac: '#909090',
  'aston-martin': '#229971',
};
const ALIASES: Record<string, string> = {
  'red-bull-racing': 'red-bull',
  'oracle-red-bull-racing': 'red-bull',
  'haas-f1-team': 'haas',
  'moneygram-haas-f1-team': 'haas',
  'kick-sauber': 'audi',
  sauber: 'audi',
  'visa-cash-app-rb': 'racing-bulls',
  rb: 'racing-bulls',
  'aston-martin-aramco': 'aston-martin',
  'cadillac-f1-team': 'cadillac',
};
export const NEUTRAL_COLOUR = '#9AA6BD';
const HEX = /^#?[0-9a-f]{6}$/i;
export const hexOf = (c: string): string => (c.startsWith('#') ? c : `#${c}`).toUpperCase();
export const isHex = (c: string): boolean => HEX.test(c);

const teamKey = (s: string): string => {
  const n = normalize(s);
  return ALIASES[n] ?? n;
};

/** A team's colour: its own hex if it carries one, else the known livery by id or name, else neutral. */
export function teamColour(t: { id: string; label?: string; colour?: string } | undefined): string {
  if (!t) return NEUTRAL_COLOUR;
  if (t.colour && isHex(t.colour)) return hexOf(t.colour);
  return TEAM_COLOURS[teamKey(t.id)] ?? (t.label ? TEAM_COLOURS[teamKey(t.label)] : undefined) ?? NEUTRAL_COLOUR;
}

/** Three letters from the surname, used when OpenF1 has no acronym for a driver. */
export function driverCode(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[parts.length - 1] ?? '').replace(/[^\p{L}]/gu, '') || name).slice(0, 3).toUpperCase();
}

/** Initials of the first two words of a team name. */
export function teamCode(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : (parts[0] ?? '').slice(0, 2).toUpperCase();
}

/** The options for one question as cards: yes/no, the teams, or the drivers in grid order. */
export function cardsFor(config: EventConfig, q: QuestionCfg, faces: Map<string, DriverFace> = EMPTY_FACES): AnswerCard[] {
  if (q.kind === 'yesno') {
    return YESNO_OPTIONS.map((o) => ({
      id: o.id, kind: 'yesno', label: o.label, first: '', main: o.label, sub: '', colour: NEUTRAL_COLOUR, headshotUrl: null, code: o.label.slice(0, 1),
    }));
  }
  if (q.kind === 'team') {
    return config.teams.map((t) => ({
      id: t.id, kind: 'team', label: t.label, first: '', main: t.label, sub: '', colour: teamColour(t), headshotUrl: null, code: teamCode(t.label),
    }));
  }
  const teams = new Map(config.teams.map((t) => [t.id, t]));
  return [...config.drivers]
    .sort((a, b) => a.grid - b.grid)
    .map((d) => {
      const team = teams.get(d.teamId);
      const face = faceFor(faces, d);
      const label = d.label
        .trim()
        .split(/\s+/)
        .map((w) => (w.length > 1 && w === w.toUpperCase() ? titleCaseName(w) : w))
        .join(' ');
      const words = label.trim().split(/\s+/);
      return {
        id: d.id,
        kind: 'driver' as const,
        label,
        first: words.length > 1 ? words.slice(0, -1).join(' ') : '',
        main: words[words.length - 1] ?? label,
        sub: team?.label ?? '',
        colour: team ? teamColour(team) : (face?.colour ?? NEUTRAL_COLOUR),
        headshotUrl: face?.headshotUrl ?? null,
        code: face?.code ?? driverCode(label),
        grid: d.grid,
      };
    });
}

/** Arrow / Home / End navigation over a grid of `n` cards laid out `cols` per row. null = key not handled. */
export function gridMove(current: number, key: string, n: number, cols: number): number | null {
  if (n <= 0) return null;
  const step = Math.max(1, Math.floor(cols) || 1);
  const i = Math.min(Math.max(0, current), n - 1);
  switch (key) {
    case 'ArrowRight':
      return Math.min(i + 1, n - 1);
    case 'ArrowLeft':
      return Math.max(i - 1, 0);
    case 'ArrowDown':
      return i + step < n ? i + step : i;
    case 'ArrowUp':
      return i - step >= 0 ? i - step : i;
    case 'Home':
      return 0;
    case 'End':
      return n - 1;
    default:
      return null;
  }
}

/** Keys 1-9 quick-pick the card at that position; anything else (or past the end) is null. */
export function digitIndex(key: string, n: number): number | null {
  if (!/^[1-9]$/.test(key)) return null;
  const i = Number(key) - 1;
  return i < n ? i : null;
}

/** Columns in the rendered grid, from the offsetTop of each card (cards on the first row share a top). */
export function columnsOf(tops: number[]): number {
  if (tops.length === 0) return 1;
  let c = 1;
  while (c < tops.length && Math.abs(tops[c] - tops[0]) < 2) c++;
  return c;
}

/** What OpenF1 knows about a driver: headshot, team colour and three-letter code. */
export interface DriverFace {
  headshotUrl: string | null;
  colour: string | null;
  code: string;
}

export const EMPTY_FACES: Map<string, DriverFace> = new Map();

/** OpenF1 /drivers rows -> faces keyed by normalised full name, surname and acronym. Bad rows are skipped. */
export function parseFaces(rows: unknown): Map<string, DriverFace> {
  const out = new Map<string, DriverFace>();
  if (!Array.isArray(rows)) return out;
  for (const r of rows) {
    if (!r || typeof r.full_name !== 'string' || !r.full_name.trim()) continue;
    const full = r.full_name.trim();
    const headshotUrl = typeof r.headshot_url === 'string' && /^https:\/\//.test(r.headshot_url) ? r.headshot_url : null;
    const colour = typeof r.team_colour === 'string' && isHex(r.team_colour) ? hexOf(r.team_colour) : null;
    const code = typeof r.name_acronym === 'string' && r.name_acronym ? r.name_acronym.toUpperCase() : driverCode(full);
    const face = { headshotUrl, colour, code };
    const last = typeof r.last_name === 'string' && r.last_name.trim() ? r.last_name : full.split(/\s+/).slice(-1)[0];
    for (const k of [normalize(full), normalize(last), code.toLowerCase()]) if (k && !out.has(k)) out.set(k, face);
  }
  return out;
}

/** Find a configured driver among the faces: by id, label, surname, then the id's last segment. */
export function faceFor(faces: Map<string, DriverFace>, d: { id: string; label: string }): DriverFace | undefined {
  const tail = (s: string, sep: RegExp) => s.split(sep).filter(Boolean).slice(-1)[0] ?? '';
  for (const k of [normalize(d.id), normalize(d.label), normalize(tail(d.label, /\s+/)), tail(normalize(d.id), /-/)]) {
    const f = k ? faces.get(k) : undefined;
    if (f) return f;
  }
  return undefined;
}

