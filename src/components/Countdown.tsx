import { useCountdown } from '../lib/useCountdown';

const pad = (n: number) => String(n).padStart(2, '0');

export default function Countdown({
  target,
  className = '',
}: {
  target: string | number | Date | null | undefined;
  className?: string;
}) {
  const { days, hours, minutes, seconds } = useCountdown(target);
  const clock = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return (
    <span className={`font-mono tabular-nums ${className}`} role="timer">
      {days > 0 ? `${days}d ${clock}` : clock}
    </span>
  );
}
