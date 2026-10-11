import { LockSimple, LockSimpleOpen } from '@phosphor-icons/react';
import Button from '../../components/Button';
import { setOverride, extendCloses } from '../../lib/db';
import type { QuizPrimary } from './quizControls';

/** Run the primary action for an event (shared so both host surfaces do exactly the same thing). */
export function runPrimary(eventId: string, p: QuizPrimary): Promise<void> {
  if (!p.action) return Promise.resolve();
  return p.action.type === 'override'
    ? setOverride(eventId, p.action.value)
    : extendCloses(eventId, p.action.minutes, p.action.uncapped);
}

/** The open/close/reopen button with its disabled reason as visible text. Rendered by RaceControl and LiveControls. */
export default function QuizPrimaryButton({
  primary,
  busy,
  onPress,
  testId,
}: {
  primary: QuizPrimary;
  busy: boolean;
  onPress: () => void;
  testId?: string;
}) {
  if (primary.kind === 'none') return null;
  const Icon = primary.kind === 'close' ? LockSimple : LockSimpleOpen;
  return (
    <div className="flex flex-col gap-1">
      <Button
        variant={primary.kind === 'close' ? 'primary' : 'secondary'}
        disabled={busy || primary.disabled}
        onClick={onPress}
        data-testid={testId}
      >
        <Icon size={20} weight="regular" aria-hidden="true" /> {primary.label}
      </Button>
      {primary.disabled && primary.reason && <p className="max-w-sm text-sm text-muted">{primary.reason}</p>}
    </div>
  );
}
