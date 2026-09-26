import type { Answers } from '../lib/types';

export interface Draft {
  name: string;
  phone: string;
  answers: Partial<Answers>;
  step: number;
}

const KEY = 'kartar-cup:draft:v1';
export const EMPTY_DRAFT: Draft = { name: '', phone: '', answers: {}, step: 0 };

export function loadDraft(): Draft {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY_DRAFT };
    const d = JSON.parse(raw) as Partial<Draft>;
    return {
      name: typeof d.name === 'string' ? d.name : '',
      phone: typeof d.phone === 'string' ? d.phone : '',
      answers: d.answers && typeof d.answers === 'object' ? d.answers : {},
      step: typeof d.step === 'number' ? d.step : 0,
    };
  } catch {
    return { ...EMPTY_DRAFT };
  }
}

export function saveDraft(d: Draft): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    /* storage blocked or full: drafting is best-effort */
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
