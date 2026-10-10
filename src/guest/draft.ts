export type PickMap = Record<string, string>;

export interface Draft {
  answers: PickMap;
  step: number;
}

// Keyed by event id so a new race never shows the previous race's answers.
const key = (eventId: string) => `kartar-cup:draft:v2:${eventId}`;
export const EMPTY_DRAFT: Draft = { answers: {}, step: 0 };

export function loadDraft(eventId: string): Draft {
  try {
    const raw = localStorage.getItem(key(eventId));
    if (!raw) return { ...EMPTY_DRAFT, answers: {} };
    const d = JSON.parse(raw) as Partial<Draft>;
    const answers: PickMap = {};
    if (d.answers && typeof d.answers === 'object') {
      for (const [q, a] of Object.entries(d.answers)) if (typeof a === 'string') answers[q] = a;
    }
    const step = typeof d.step === 'number' && Number.isInteger(d.step) && d.step >= 0 ? d.step : 0;
    return { answers, step };
  } catch {
    return { ...EMPTY_DRAFT, answers: {} };
  }
}

export function saveDraft(eventId: string, d: Draft): void {
  try {
    localStorage.setItem(key(eventId), JSON.stringify(d));
  } catch {
    /* storage blocked or full: drafting is best-effort */
  }
}

export function clearDraft(eventId: string): void {
  try {
    localStorage.removeItem(key(eventId));
  } catch {
    /* ignore */
  }
}
