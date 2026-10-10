/** "+3 pts" chip in gold: what a call is worth. */
export default function PointsBadge({ pts, small = false, className = '' }: { pts: number; small?: boolean; className?: string }) {
  return (
    <span className={`inline-flex shrink-0 items-baseline gap-1 rounded-md border border-gold/40 bg-gold/10 text-gold ${small ? 'px-1.5 py-px' : 'px-2.5 py-1'} ${className}`}>
      <span className={`font-num font-extrabold italic leading-none tabular-nums ${small ? 'text-base' : 'text-2xl'}`}>+{pts}</span>
      <span className="font-mono text-[0.65rem] uppercase tracking-widest">{pts === 1 ? 'pt' : 'pts'}</span>
    </span>
  );
}
