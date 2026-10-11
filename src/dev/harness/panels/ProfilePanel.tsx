import { useMemo, useState } from 'react';
import AchievementsSection from '../../../guest/AchievementsSection';
import { computeStreaks } from '../../../guest/achievements';
import { PHONE_ERROR, bookingStatusLabel, entryStatusLabel, formatInr, initials, parsePhone, sortOwnEntries, type OwnEntryRow } from '../../../guest/profileModel';
import { cardBonusByUid } from '../../../lib/scoring';
import { BASE_MS, mockBooking, mockBookingEvent, mockPlayCard } from '../../fixtures';
import type { PanelProps } from '../MockLab';
import { Case, Grid, Json, Pick } from '../parts';

/* ProfilePage and useOwnCardBonus read Firestore, so they are not mounted. AchievementsSection takes plain props and is, along with the model helpers. */

type Who = 'loading' | 'new' | 'regular' | 'streak';
const WHO: { id: Who; label: string }[] = [
  { id: 'loading', label: 'Loading' },
  { id: 'new', label: 'New guest (nothing yet)' },
  { id: 'regular', label: 'Regular (gap in events)' },
  { id: 'streak', label: 'Streak of 5' },
];

const DAY = 86_400_000;
const row = (i: number, score: number | null, order = i): OwnEntryRow => ({ eventId: `e${i}`, eventName: `Race ${i}`, submittedAtMs: BASE_MS - (10 - i) * 7 * DAY, score, maxScore: 5, eventOrder: order });

function dataFor(w: Who): { rows?: OwnEntryRow[]; bookings?: ReturnType<typeof mockBooking>[] } {
  switch (w) {
    case 'loading':
      return {};
    case 'new':
      return { rows: [], bookings: [] };
    case 'regular':
      return { rows: [row(1, 3), row(2, 5), row(4, null, 4)], bookings: [mockBooking(), mockBooking({ id: 'b2', status: 'checked_in' })] };
    default:
      return { rows: [1, 2, 3, 4, 5].map((i) => row(i, i % 5, i)), bookings: [mockBooking({ status: 'checked_in' })] };
  }
}

export default function ProfilePanel(_props: PanelProps) {
  const [who, setWho] = useState<Who>('regular');
  const { rows, bookings } = useMemo(() => dataFor(who), [who]);
  const event = mockBookingEvent();
  const withCard = [mockBooking({ playCard: mockPlayCard() }), mockBooking({ id: 'b2', status: 'cancelled', playCard: mockPlayCard() })];
  return (
    <Grid>
      <Case title="Achievements" note="AchievementsSection from the guest's own entries and bookings (R15/R31): skeleton while loading, locked and earned tiles, streaks." wide>
        <Pick label="Guest" value={who} options={WHO} onChange={setWho} />
        <div className="mt-4"><AchievementsSection rows={rows} bookings={bookings} /></div>
        {rows && <p className="mt-2 font-mono text-[0.65rem] text-muted">streaks: {JSON.stringify(computeStreaks(rows))}</p>}
      </Case>
      <Case title="Own history" note="Newest first, with the status line a row gets before and after results are published.">
        <ul className="space-y-1 text-xs">
          {sortOwnEntries([row(1, null), row(2, 4), row(3, 0)]).map((r) => (
            <li key={r.eventId} className="text-muted"><span className="text-ink">{r.eventName}</span> · {entryStatusLabel(r)}</li>
          ))}
        </ul>
      </Case>
      <Case title="Own bookings" note="Status labels and rupee formatting.">
        <ul className="space-y-1 text-xs">
          {(['reserved', 'paid_mock', 'checked_in', 'cancelled'] as const).map((s) => (
            <li key={s} className="text-muted"><span className="text-ink">{bookingStatusLabel(s)}</span> · {event.title} · {formatInr(mockBooking().totalInr)}</li>
          ))}
        </ul>
      </Case>
      <Case title="Avatar and phone" note="initials() fallbacks and parsePhone().">
        <p className="text-xs text-muted">
          {[initials('Aarav Menon'), initials('Madonna'), initials('', 'zed@example.test'), initials(null, null)].map((s, i) => (
            <span key={i} className="mr-2 inline-block rounded-full border border-line px-2 py-0.5 font-mono text-ink">{s || '(empty)'}</span>
          ))}
        </p>
        <ul className="mt-2 space-y-1 font-mono text-xs text-muted">
          {['+91 98765 43210', '12345', 'call me'].map((p) => (
            <li key={p}>{JSON.stringify(p)} → {JSON.stringify(parsePhone(p))}</li>
          ))}
        </ul>
        <p className="mt-1 text-xs text-muted">Error copy: {PHONE_ERROR}</p>
      </Case>
      <Case title="Card bonus" note="What useOwnCardBonus sums: Play card points on live bookings of the quiz's event (R46). The cancelled booking is skipped.">
        <Json label="cardBonusByUid" value={cardBonusByUid(withCard, new Set([event.id]))} />
      </Case>
    </Grid>
  );
}
