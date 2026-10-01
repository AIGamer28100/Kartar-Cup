import Button from '../components/Button';
import StatusDot from '../components/StatusDot';
import type { EventConfig } from '../lib/types';
import { quizGateVariant } from './quizGate';
import { CloseTimer, Reveal } from './parts';

/**
 * R25: the quiz is a MINOR, event-only feature — a slim contextual card, never a headline
 * section. Shown only when the active event's window is genuinely open; a one-line note while
 * scheduled; nothing once closed/scored. Credited to "The Karter Club" (the real watch-party
 * sub-brand) here only — the name does not appear anywhere else on the site.
 */
export default function QuizBanner({
  event,
  status,
  onReveal,
}: {
  event: EventConfig | null | undefined;
  status: 'scheduled' | 'open' | 'closed' | 'scored' | null;
  onReveal: () => void;
}) {
  const variant = quizGateVariant(status);
  if (variant === 'none' || !event) return null;

  if (variant === 'minimal') {
    return (
      <Reveal>
        <p className="font-mono text-xs uppercase tracking-widest text-muted">
          Predictions open at lights-out — presented by The Karter Club
        </p>
      </Reveal>
    );
  }

  return (
    <Reveal>
      <div className="flex flex-col gap-4 rounded-lg border border-line bg-raised p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <StatusDot status="open" />
            <p className="font-mono text-xs uppercase tracking-widest text-muted">
              Tonight&rsquo;s watch party · presented by The Karter Club
            </p>
          </div>
          <p className="mt-2 text-lg font-medium text-ink">Predict the race — 2 min, on the house.</p>
          <CloseTimer closesAt={event.closesAt.toMillis()} className="mt-1" />
        </div>
        <Button onClick={onReveal} className="shrink-0">
          Predict now
        </Button>
      </div>
    </Reveal>
  );
}
