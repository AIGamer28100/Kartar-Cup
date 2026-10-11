import { describe, expect, it } from 'vitest';
import { quizGateVariant } from './quizGate';

describe('quizGateVariant', () => {
  it('shows the small banner only when the quiz window is genuinely open', () => {
    expect(quizGateVariant('open')).toBe('banner');
  });
  it('shows a minimal line while scheduled', () => {
    expect(quizGateVariant('scheduled')).toBe('minimal');
  });
  it('shows nothing once closed, scored, or with no event', () => {
    expect(quizGateVariant('closed')).toBe('none');
    expect(quizGateVariant('scored')).toBe('none');
    expect(quizGateVariant(null)).toBe('none');
    expect(quizGateVariant(undefined)).toBe('none');
  });
});
