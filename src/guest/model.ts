import { pointsMap, scoreEntry } from '../lib/scoring';
import { YESNO_OPTIONS } from '../lib/types';
import type { EventConfig, Option, QuestionCfg } from '../lib/types';
import type { PickMap } from './draft';

const WA_ALLOW = ['https://chat.whatsapp.com/', 'https://whatsapp.com/channel/'];
export const safeWhatsappUrl = (u: string | undefined): string =>
  u && WA_ALLOW.some((p) => u.startsWith(p) && u.length > p.length) ? u : '';

export function optionsFor(config: EventConfig, q: QuestionCfg): Option[] {
  if (q.kind === 'yesno') return YESNO_OPTIONS;
  if (q.kind === 'team') return config.teams.map((t) => ({ id: t.id, label: t.label }));
  const teamLabel = new Map(config.teams.map((t) => [t.id, t.label]));
  return [...config.drivers]
    .sort((a, b) => a.grid - b.grid)
    .map((d) => {
      const team = teamLabel.get(d.teamId);
      return { id: d.id, label: d.label, sub: `${team ? `${team} · ` : ''}P${d.grid}` };
    });
}

export function optionLabel(config: EventConfig, q: QuestionCfg, id: string | undefined): string {
  if (!id) return 'No pick';
  return optionsFor(config, q).find((o) => o.id === id)?.label ?? id;
}

export function scoreOwn(
  config: EventConfig,
  answers: PickMap,
  results: Record<string, string[]>,
): { score: number; ticks: Record<string, boolean> } {
  return scoreEntry(answers, results, config.questionIds, pointsMap(config.questions));
}

const IST = 'Asia/Kolkata';
export function istReadout(startMs: number): { day: string; month: string; time: string } {
  const d = new Date(startMs);
  const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-GB', { timeZone: IST, ...o }).format(d);
  return {
    day: f({ day: '2-digit' }),
    month: f({ month: 'short' }).toUpperCase(),
    time: f({ hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }),
  };
}

export function formatRemaining(totalMs: number): string {
  const s = Math.max(0, Math.floor(totalMs / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const p = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${p(m)}:${p(s % 60)}` : `${p(m)}:${p(s % 60)}`;
}
