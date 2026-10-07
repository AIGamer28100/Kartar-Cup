/* Pure helpers for the race detail results hub (formula1.com-style classification). No React, no DOM. */
import { formatLapTime, sessionPhase, type RaceSession, type ResultRow, type SessionPhase } from '../../lib/raceData';

export type SessionKind = 'practice' | 'qualifying' | 'sprint' | 'race';

/** OpenF1 session names -> kind. Sprint Qualifying / Sprint Shootout count as qualifying. */
export function sessionKind(name: string): SessionKind {
  const n = name.toLowerCase();
  if (n === 'race') return 'race';
  if (n === 'sprint') return 'sprint';
  if (n.includes('qualifying') || n.includes('shootout')) return 'qualifying';
  if (n.includes('practice')) return 'practice';
  return n.includes('sprint') ? 'sprint' : 'practice';
}

/** Points are awarded only in the race and the sprint. */
export const isPointsSession = (name: string): boolean => {
  const k = sessionKind(name);
  return k === 'race' || k === 'sprint';
};

/** Short tab label for narrow screens; the full name is shown from sm up. */
export function shortSessionLabel(name: string): string {
  const m = /^practice\s*(\d)$/i.exec(name.trim());
  if (m) return `FP${m[1]}`;
  const n = name.toLowerCase();
  if (n === 'sprint qualifying' || n === 'sprint shootout') return 'SQ';
  if (n === 'qualifying') return 'Quali';
  return name;
}

/** Classification status for retirements and penalties, or null for a normal classified finish. */
export function statusText(r: Pick<ResultRow, 'dnf' | 'dns' | 'dsq' | 'position'>): 'DSQ' | 'DNS' | 'DNF' | 'NC' | null {
  if (r.dsq) return 'DSQ';
  if (r.dns) return 'DNS';
  if (r.dnf) return 'DNF';
  if (r.position == null) return 'NC';
  return null;
}

/** Race duration "1:32:05.123" (hours always shown, like an official classification). */
export function formatRaceTime(sec: number | null): string {
  if (sec == null || !Number.isFinite(sec) || sec <= 0) return '';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec - h * 3600 - m * 60;
  return `${h}:${String(m).padStart(2, '0')}:${s.toFixed(3).padStart(6, '0')}`;
}

/** "+1 Lap" / "+3 Laps" when a finisher was lapped. */
export function lapsDownText(leaderLaps: number | null, laps: number | null): string {
  if (leaderLaps == null || laps == null) return '';
  const down = leaderLaps - laps;
  if (down <= 0) return '';
  return `+${down} ${down === 1 ? 'Lap' : 'Laps'}`;
}

/** Normalise an OpenF1 gap ("+1 LAP", "+12.345", "12.345") to the classification style. */
export function normaliseGap(gap: string): string {
  const g = gap.trim();
  if (!g) return '';
  const lap = /^\+?(\d+)\s*laps?$/i.exec(g);
  if (lap) return lapsDownText(Number(lap[1]), 0);
  if (/^\+?\d+(\.\d+)?$/.test(g)) {
    const n = Number(g.replace('+', ''));
    return n === 0 ? '' : `+${n.toFixed(3)}`;
  }
  return g;
}

/**
 * TIME / GAP cell, formula1.com style: the winner (or fastest) shows the full time, everyone else the
 * gap to them; retirements show their status text instead. Qualifying shows each driver's own best
 * lap from the last part they reached (gaps across Q1/Q2/Q3 are not comparable).
 */
export function timeOrGap(r: ResultRow, leader: ResultRow | undefined, kind: SessionKind): string {
  const status = statusText(r);
  if (status && status !== 'NC') return status;
  const isLeader = leader != null && r.number === leader.number;
  if (kind === 'race' || kind === 'sprint') {
    if (isLeader) return formatRaceTime(r.time) || (r.laps != null ? `${r.laps} laps` : '');
    return normaliseGap(r.gap) || lapsDownText(leader?.laps ?? null, r.laps) || (status ?? '');
  }
  if (kind === 'qualifying') return r.time != null ? formatLapTime(r.time) : status ?? '';
  if (isLeader) return r.time != null ? formatLapTime(r.time) : '';
  if (r.gap) return normaliseGap(r.gap);
  if (leader?.time != null && r.time != null) {
    const d = r.time - leader.time;
    return d > 0 ? `+${d.toFixed(3)}` : formatLapTime(r.time);
  }
  return status ?? '';
}

/** "Max Verstappen" -> { first: "Max", last: "Verstappen" } (multi-word given names stay together). */
export function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length <= 1) return { first: '', last: parts[0] ?? '' };
  return { first: parts.slice(0, -1).join(' '), last: parts[parts.length - 1] };
}

export interface SessionTabState {
  session: RaceSession;
  phase: SessionPhase;
  /** Results can be requested (finished, past the data blackout, not cancelled). */
  available: boolean;
  /** Why the tab is disabled, shown under its name. */
  note: string;
}

export function sessionTabs(sessions: RaceSession[], now = Date.now()): SessionTabState[] {
  return sessions.map((s) => {
    const phase = sessionPhase(s, now);
    const available = phase === 'done' && !s.cancelled;
    const note = s.cancelled ? 'Cancelled' : phase === 'upcoming' ? 'Upcoming' : phase === 'inprogress' ? 'Live' : '';
    return { session: s, phase, available, note };
  });
}

/** The most relevant completed session: the latest one (by start) whose results are available. */
export function defaultSessionKey(sessions: RaceSession[], now = Date.now()): number | null {
  const done = sessionTabs(sessions, now).filter((t) => t.available);
  if (!done.length) return null;
  return done.reduce((a, b) => (Date.parse(b.session.startUtc) >= Date.parse(a.session.startUtc) ? b : a)).session.key;
}

export interface LapLike {
  driver_number: number;
  lap_number?: number;
  lap_duration?: number | null;
}

/** Quickest single lap of a session (ties: the earlier lap, as the official award goes to who set it first). */
export function fastestLapOf(laps: LapLike[]): { driverNumber: number; lapNumber: number | null; seconds: number } | null {
  let best: { driverNumber: number; lapNumber: number | null; seconds: number } | null = null;
  for (const l of laps) {
    const t = l.lap_duration;
    if (typeof t !== 'number' || !Number.isFinite(t) || t <= 0) continue;
    if (!best || t < best.seconds || (t === best.seconds && (l.lap_number ?? Infinity) < (best.lapNumber ?? Infinity))) {
      best = { driverNumber: l.driver_number, lapNumber: l.lap_number ?? null, seconds: t };
    }
  }
  return best;
}
