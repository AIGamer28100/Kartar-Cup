import type { EventStatus } from '../lib/types';

const COLOR: Record<EventStatus, string> = {
  open: 'bg-accent',
  locked: 'bg-muted',
  scored: 'bg-ink',
};

export default function StatusDot({
  status,
  className = '',
}: {
  status: EventStatus;
  className?: string;
}) {
  const breathe = status === 'open' ? 'motion-safe:animate-[breathe_2.4s_ease-in-out_infinite]' : '';
  return (
    <span
      aria-hidden="true"
      className={`inline-block size-2.5 rounded-full ${COLOR[status]} ${breathe} ${className}`}
    />
  );
}
