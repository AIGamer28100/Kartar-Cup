import { describe, expect, it } from 'vitest';
import { deriveLiveQuizId, liveQuizMode } from './liveQuiz';

const NOW = 1_000_000_000_000;
const H = 3_600_000;
const ev = (id: string, dateMs: number, quizEventId: string | undefined = `q-${id}`, cancelled = false) =>
  ({ id, dateMs, quizEventId, cancelled }) as never;

describe('liveQuiz', () => {
  it('defaults to manual', () => {
    expect(liveQuizMode(undefined)).toBe('manual');
    expect(liveQuizMode('auto')).toBe('auto');
  });
  it('picks the nearest party inside now-8h..now+72h', () => {
    expect(deriveLiveQuizId([ev('a', NOW + 48 * H), ev('b', NOW + 5 * H)], NOW)).toBe('q-b');
    expect(deriveLiveQuizId([ev('a', NOW - 9 * H), ev('b', NOW + 73 * H)], NOW)).toBeNull();
    expect(deriveLiveQuizId([ev('a', NOW - 7 * H)], NOW)).toBe('q-a');
  });
  it('skips cancelled and quiz-less parties', () => {
    expect(deriveLiveQuizId([ev('a', NOW, 'x', true), ev('b', NOW, ''), ev('c', NOW + H)], NOW)).toBe('q-c');
  });
  it('breaks ties toward the earlier date', () => {
    expect(deriveLiveQuizId([ev('a', NOW + H), ev('b', NOW - H)], NOW)).toBe('q-b');
  });
});
