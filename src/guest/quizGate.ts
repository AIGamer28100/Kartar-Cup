import type { DerivedStatus } from '../lib/types';

/**
 * R25: the prediction quiz is a minor, event-only feature — never the home page's headline.
 * - 'banner': a slim, contextual card/CTA ("Tonight's watch party: predict the race") — only
 *   when the active event's quiz window is genuinely open.
 * - 'minimal': a single line ("predictions open at lights-out") while scheduled — no section,
 *   no CTA.
 * - 'none': no event, closed, or scored — say nothing here (closed/scored guests who already
 *   have an entry can still reach it by revealing, but the home page stays quiet).
 */
export type QuizGateVariant = 'banner' | 'minimal' | 'none';

export function quizGateVariant(status: DerivedStatus | null | undefined): QuizGateVariant {
  if (status === 'open') return 'banner';
  if (status === 'scheduled') return 'minimal';
  return 'none';
}
