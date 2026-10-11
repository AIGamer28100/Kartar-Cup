import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_DRAFT, clearDraft, loadDraft, saveDraft } from './draft';

function stubStorage(): Map<string, string> {
  const m = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  });
  return m;
}

let store: Map<string, string>;
beforeEach(() => {
  vi.unstubAllGlobals();
  store = stubStorage();
});

describe('draft', () => {
  it('returns an empty draft when nothing is saved, and never the shared EMPTY_DRAFT object', () => {
    const d = loadDraft('r1');
    expect(d).toEqual({ answers: {}, step: 0 });
    expect(d.answers).not.toBe(EMPTY_DRAFT.answers);
  });

  it('round-trips a saved draft', () => {
    saveDraft('r1', { answers: { q1: 'a', q2: 'b' }, step: 2 });
    expect(loadDraft('r1')).toEqual({ answers: { q1: 'a', q2: 'b' }, step: 2 });
  });

  it('keeps drafts separate per event', () => {
    saveDraft('r1', { answers: { q1: 'a' }, step: 1 });
    expect(loadDraft('r2')).toEqual({ answers: {}, step: 0 });
  });

  it('clearDraft removes only that event', () => {
    saveDraft('r1', { answers: { q1: 'a' }, step: 1 });
    saveDraft('r2', { answers: { q1: 'b' }, step: 1 });
    clearDraft('r1');
    expect(loadDraft('r1')).toEqual({ answers: {}, step: 0 });
    expect(loadDraft('r2').answers).toEqual({ q1: 'b' });
  });

  it('drops non-string answers and bad steps', () => {
    store.set('kartar-cup:draft:v2:r1', JSON.stringify({ answers: { q1: 'a', q2: 5, q3: null }, step: -1 }));
    expect(loadDraft('r1')).toEqual({ answers: { q1: 'a' }, step: 0 });
    store.set('kartar-cup:draft:v2:r1', JSON.stringify({ answers: {}, step: 1.5 }));
    expect(loadDraft('r1').step).toBe(0);
    store.set('kartar-cup:draft:v2:r1', JSON.stringify({ answers: 'x', step: '2' }));
    expect(loadDraft('r1')).toEqual({ answers: {}, step: 0 });
  });

  it('accepts step 0 and large integer steps', () => {
    store.set('kartar-cup:draft:v2:r1', JSON.stringify({ answers: {}, step: 7 }));
    expect(loadDraft('r1').step).toBe(7);
  });

  it('survives corrupt JSON', () => {
    store.set('kartar-cup:draft:v2:r1', '{not json');
    expect(loadDraft('r1')).toEqual({ answers: {}, step: 0 });
  });

  it('never throws when storage is blocked', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('full'); },
      removeItem: () => { throw new Error('blocked'); },
    });
    expect(() => saveDraft('r1', EMPTY_DRAFT)).not.toThrow();
    expect(() => clearDraft('r1')).not.toThrow();
    expect(loadDraft('r1')).toEqual({ answers: {}, step: 0 });
  });
});
