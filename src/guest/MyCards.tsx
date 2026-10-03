import { useEffect, useState } from 'react';
import { cardImageSrc, watchVipCards } from '../lib/cards';
import type { Booking, CardDoc } from '../lib/types';

/** R45/R46, R15: the guest's OWN VIP pass and Play card on their ticket. The VIP design is the same for
 * everyone (readable by signed-in guests); the Play card is the snapshot the host copied onto this
 * booking at check-in, so no other guest's card, and not the rest of the deck, is ever loaded here. */
export default function MyCards({ booking }: { booking: Booking }) {
  const [vip, setVip] = useState<CardDoc | null>(null);

  useEffect(() => watchVipCards(booking.bookingEventId, (c) => setVip(c[0] ?? null), () => setVip(null)), [booking.bookingEventId]);

  const play = booking.playCard;
  const hasAny = booking.passNumber != null || play;
  if (!hasAny) {
    return booking.status === 'paid_mock' ? (
      <p className="max-w-xl text-sm text-muted">Your VIP pass and a random Play card are handed to you at check-in.</p>
    ) : null;
  }

  const vipSrc = cardImageSrc(vip);
  const playSrc = cardImageSrc(play);

  return (
    <section aria-labelledby="my-cards" className="max-w-xl">
      <h2 id="my-cards" className="font-mono text-sm uppercase tracking-widest text-muted">Your cards</h2>
      <div className="mt-3 grid grid-cols-2 gap-4">
        {booking.passNumber != null && (
          <figure className="min-w-0">
            {vipSrc ? (
              <img src={vipSrc} alt="Your VIP Guest pass" loading="lazy" className="w-full rounded-lg border border-line object-contain" />
            ) : (
              <div className="flex aspect-[2/3] items-center justify-center rounded-lg border border-line text-sm text-muted">VIP Guest</div>
            )}
            <figcaption className="mt-2 text-sm">
              VIP pass <span className="font-mono tabular-nums">#{booking.passNumber}</span>
            </figcaption>
          </figure>
        )}
        {play && (
          <figure className="min-w-0">
            {playSrc ? (
              <img src={playSrc} alt={`Your Play card: ${play.driverName}`} loading="lazy" className="w-full rounded-lg border border-line object-contain" />
            ) : (
              <div className="flex aspect-[2/3] items-center justify-center rounded-lg border border-line text-sm text-muted">{play.driverName}</div>
            )}
            <figcaption className="mt-2 text-sm">
              {play.driverName}
              <span className="block font-mono text-xs tabular-nums text-muted">+{play.points} pts in your quiz score</span>
            </figcaption>
          </figure>
        )}
      </div>
    </section>
  );
}
