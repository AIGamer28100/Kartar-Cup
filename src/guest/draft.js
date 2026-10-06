// Keyed by event id so a new race never shows the previous race's answers.
const key = (eventId) => `kartar-cup:draft:v2:${eventId}`;
export const EMPTY_DRAFT = { name: '', phone: '', answers: {}, step: 0 };
export function loadDraft(eventId) {
    try {
        const raw = localStorage.getItem(key(eventId));
        if (!raw)
            return { ...EMPTY_DRAFT, answers: {} };
        const d = JSON.parse(raw);
        return {
            name: typeof d.name === 'string' ? d.name : '',
            phone: typeof d.phone === 'string' ? d.phone : '',
            answers: d.answers && typeof d.answers === 'object' ? d.answers : {},
            step: typeof d.step === 'number' ? d.step : 0,
        };
    }
    catch {
        return { ...EMPTY_DRAFT, answers: {} };
    }
}
export function saveDraft(eventId, d) {
    try {
        localStorage.setItem(key(eventId), JSON.stringify(d));
    }
    catch {
        /* storage blocked or full: drafting is best-effort */
    }
}
export function clearDraft(eventId) {
    try {
        localStorage.removeItem(key(eventId));
    }
    catch {
        /* ignore */
    }
}
