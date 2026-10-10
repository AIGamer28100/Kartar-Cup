import { describe, expect, it, vi } from 'vitest';
import type { BookingEvent, EventConfig } from '../../lib/types';
import { ensureQuizForBookingEvent, type QuizLinkDeps } from './quizLink';

// The real builder reads OpenF1 for the grid; the wiring under test only needs a config shell.
vi.mock('../../config/event', () => ({
  buildDefaultEvent: async () => ({ config: { id: 'x', name: 'x', raceDurationMin: 90, questionIds: [] }, gridStatus: 'ok' }),
}));

const ev = (over: Partial<BookingEvent> = {}) =>
  ({ id: 'be1', title: 'Watch party', dateUtc: '2026-11-01T12:00:00.000Z', dateMs: Date.parse('2026-11-01T12:00:00.000Z'), ...over }) as BookingEvent;

function deps(over: Partial<QuizLinkDeps> = {}) {
  const d = {
    saveQuiz: vi.fn<(c: EventConfig) => Promise<void>>(async () => {}),
    newQuizId: vi.fn(() => 'q-new'),
    getBookingEvent: vi.fn(async (id: string) => ev({ id })),
    getQuiz: vi.fn(async () => null as EventConfig | null),
    linkQuiz: vi.fn(async () => {}),
  };
  Object.assign(d, over);
  return d;
}

describe('ensureQuizForBookingEvent', () => {
  it('creates, saves and links a quiz the first time', async () => {
    const d = deps();
    await expect(ensureQuizForBookingEvent(ev(), d)).resolves.toBe('q-new');
    expect(d.saveQuiz).toHaveBeenCalledOnce();
    expect(d.saveQuiz.mock.calls[0][0]).toMatchObject({ id: 'q-new', name: 'Watch party', raceId: 'custom' });
    expect(d.linkQuiz).toHaveBeenCalledWith('be1', 'q-new');
  });

  it('reuses an existing linked quiz', async () => {
    const d = deps({
      getBookingEvent: vi.fn(async (id: string) => ev({ id, quizEventId: 'q-old' })),
      getQuiz: vi.fn(async () => ({ id: 'q-old' }) as EventConfig),
    });
    await expect(ensureQuizForBookingEvent(ev(), d)).resolves.toBe('q-old');
    expect(d.saveQuiz).not.toHaveBeenCalled();
    expect(d.linkQuiz).not.toHaveBeenCalled();
  });

  it('re-creates a missing linked quiz under the same id without relinking', async () => {
    const d = deps({ getBookingEvent: vi.fn(async (id: string) => ev({ id, quizEventId: 'q-gone' })) });
    await expect(ensureQuizForBookingEvent(ev(), d)).resolves.toBe('q-gone');
    expect(d.saveQuiz.mock.calls[0][0]).toMatchObject({ id: 'q-gone' });
    expect(d.linkQuiz).not.toHaveBeenCalled();
  });

  it('shares one creation between concurrent calls', async () => {
    const d = deps();
    const [a, b] = await Promise.all([ensureQuizForBookingEvent(ev(), d), ensureQuizForBookingEvent(ev(), d)]);
    expect(a).toBe(b);
    expect(d.saveQuiz).toHaveBeenCalledOnce();
  });
});
