import { useMemo, useState } from 'react';
import { cardImageSrc, drawRandomPlayCard, nextPassNumber, toSnapshot } from '../../../lib/cards';
import { cardBonusByUid } from '../../../lib/scoring';
import { mockBookingEvent, mockCards } from '../../fixtures';
import type { PanelProps } from '../MockLab';
import { Case, Grid, Json, LabButton } from '../parts';

/* CardAssign and MyCards read and write Firestore, so they are not mounted. Their pure helpers are exercised here. */

const IMG = `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="#555"/></svg>')}`;

export default function CardsPanel(_props: PanelProps) {
  const cards = useMemo(mockCards, []);
  const [seq, setSeq] = useState(0);
  const [rand, setRand] = useState(0);
  const event = mockBookingEvent({ cardSeq: seq });
  const drawn = drawRandomPlayCard(cards, () => rand);
  return (
    <Grid>
      <Case title="Deck" note="mockCards(): one VIP design and four Play cards (driver, code, number, points)." wide>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-line text-left font-mono text-[0.65rem] uppercase tracking-widest text-muted">
              <th className="py-1 pr-2 font-normal">kind</th><th className="py-1 pr-2 font-normal">name</th><th className="py-1 pr-2 font-normal">code</th><th className="py-1 pr-2 font-normal">no.</th><th className="py-1 font-normal">pts</th>
            </tr>
          </thead>
          <tbody>
            {cards.map((c) => (
              <tr key={c.id} className="border-b border-line/60">
                <td className="py-1 pr-2 text-ink">{c.kind}</td>
                <td className="py-1 pr-2 text-ink">{c.driverName ?? c.title}</td>
                <td className="py-1 pr-2 font-mono text-muted">{c.code ?? '-'}</td>
                <td className="py-1 pr-2 font-mono text-muted">{c.number ?? '-'}</td>
                <td className="py-1 font-mono text-muted">{c.points ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Json label="snapshot of first play card (what lands on the booking)" value={toSnapshot(cards[1])} />
      </Case>
      <Case title="Random draw" note="drawRandomPlayCard only draws from kind=play and clamps rand=1 to the last card.">
        <div className="flex flex-wrap gap-2">
          {[0, 0.3, 0.6, 0.999, 1].map((r) => (
            <LabButton key={r} pressed={rand === r} onClick={() => setRand(r)}>rand {r}</LabButton>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted">Drew: <span className="text-ink">{drawn?.driverName ?? 'nothing'}</span> ({drawn?.points ?? 0} pts)</p>
        <p className="mt-1 text-xs text-muted">Empty deck: <span className="text-ink">{String(drawRandomPlayCard([], () => 0))}</span> · VIP-only deck: <span className="text-ink">{String(drawRandomPlayCard([cards[0]], () => 0))}</span></p>
      </Case>
      <Case title="Pass numbers" note="The highest pass is cardSeq; the next guest gets cardSeq + 1.">
        <div className="flex flex-wrap gap-2">
          {[0, 7, 119].map((n) => (
            <LabButton key={n} pressed={seq === n} onClick={() => setSeq(n)}>cardSeq {n}</LabButton>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted">Next pass: <span className="font-mono text-ink">#{nextPassNumber(event)}</span></p>
        <p className="mt-1 text-xs text-muted">Image src: <span className="font-mono text-ink">{String(cardImageSrc({ image: IMG, imageUrl: 'https://cdn.example.test/c.png' }))}</span> (CDN link wins) · <span className="font-mono text-ink">{String(cardImageSrc({ image: 'inline' }))}</span> · <span className="font-mono text-ink">{String(cardImageSrc(null))}</span></p>
      </Case>
      <Case title="Score bonus" note="cardBonusByUid: parses each guest's card-question answer (R71); bad or missing answers add 0." wide>
        <Json label="bonus by uid (u1 norris:5, u2 malformed, u3 no answer)" value={cardBonusByUid([{ uid: 'u1', answers: { q6: 'norris:5' } }, { uid: 'u2', answers: { q6: 'norris:x' } }, { uid: 'u3', answers: {} }], [{ id: 'q6', kind: 'card' }])} />
      </Case>
    </Grid>
  );
}
