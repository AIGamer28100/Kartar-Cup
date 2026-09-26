export default function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`rounded-lg bg-raised motion-safe:animate-pulse ${className}`} />
  );
}
