import { useState } from 'react';
import { portraitUrl } from '../../lib/portrait';
import type { AnswerCard } from './grid';

/** Face tile: driver headshot on the team colour, else the code / initials. `cols` sizes the portrait request. */
export default function Tile({ card, className = '', cols = 2, big = false }: { card: AnswerCard; className?: string; cols?: number; big?: boolean }) {
  const [broken, setBroken] = useState(false);
  const src = card.kind === 'driver' ? portraitUrl(card.headshotUrl, cols) : null;
  const yesno = card.kind === 'yesno';
  return (
    <span
      aria-hidden="true"
      className={`relative flex shrink-0 items-end justify-center overflow-hidden ${className}`}
      style={
        yesno
          ? { background: 'var(--color-surface)' }
          : { background: `linear-gradient(160deg, color-mix(in srgb, ${card.colour} 85%, transparent), color-mix(in srgb, ${card.colour} 35%, var(--color-base)))` }
      }
    >
      {src && !broken ? (
        <img src={src} alt="" loading="lazy" decoding="async" onError={() => setBroken(true)} className="h-full w-full object-contain object-bottom" />
      ) : (
        <span
          className={`m-auto font-mono font-semibold tracking-wider text-ink ${big ? 'text-lg' : 'text-xs'}`}
          style={yesno ? undefined : { textShadow: '0 1px 2px rgb(7 11 20 / 0.6)' }}
        >
          {card.code}
        </span>
      )}
    </span>
  );
}
