import { useMemo, useState } from 'react';
import CrowdReveal from '../../../host/CrowdReveal';
import Leaderboard from '../../../host/Leaderboard';
import ResultsForm from '../../../host/ResultsForm';
import VenueSearch from '../../../host/bookings/VenueSearch';
import { STATUS_FILTERS, filterBookings, tally, tierCounts, type StatusFilter } from '../../../host/bookings/roster';
import { checkInMethodFor } from '../../../lib/bookings';
import { BASE_MS, mockBooking, mockBookingEvent, mockEntries, mockEventConfig, mockRanked, mockResults, ts } from '../../fixtures';
import type { PanelProps } from '../MockLab';
import { Case, Grid, Json, LabButton, Pick } from '../parts';

/* HostConsole, AttendeeRoster and CheckinScanner read Firestore or the camera, so they are not mounted. Leaderboard, CrowdReveal, ResultsForm,
   VenueSearch and the roster / check-in logic are. Results Save writes to Firestore: do not press it in the lab. VenueSearch needs Mock Net on. */

type Results = 'with' | 'none';

export default function HostPanel({ nowMs }: PanelProps) {
  const cfg = useMemo(() => mockEventConfig(), []);
  const rows = useMemo(() => mockRanked(), []);
  const entries = useMemo(() => mockEntries(), []);
  const [override, setOverride] = useState<string | null>(null);
  const [canPick, setCanPick] = useState(true);
  const [res, setRes] = useState<Results>('with');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [picked, setPicked] = useState<unknown>(null);

  const results = res === 'with' ? mockResults() : { q1: [], q2: [], q3: [], q4: [], q5: [] };
  const event = mockBookingEvent();
  const bookings = [
    mockBooking(),
    mockBooking({ id: 'b2', buyerName: 'Diya Raman', tierId: 'couple', qty: 1, seatsPerTicket: 2, status: 'checked_in' }),
    mockBooking({ id: 'b3', buyerName: 'Karthik Subbu', status: 'reserved', paidAt: undefined }),
    mockBooking({ id: 'b4', buyerName: 'Meera Iyer', status: 'cancelled', refund: 'mock_refunded' }),
  ];
  const shown = filterBookings(bookings, query, status);

  return (
    <Grid>
      <Case title="Leaderboard" note="Ranked fixture guests with the host's spotlight pick among the top tie (R69). Pick is local state only." wide>
        <div className="flex flex-wrap gap-2">
          <LabButton pressed={canPick} onClick={() => setCanPick((v) => !v)}>canPick</LabButton>
          <LabButton onClick={() => setOverride(null)}>clear pick</LabButton>
        </div>
        <Leaderboard rows={rows} overrideUid={override} canPick={canPick} questions={cfg.questions} onPick={setOverride} />
        <p className="font-mono text-[0.65rem] text-muted">overrideUid: {String(override)}</p>
        <Leaderboard rows={[]} overrideUid={null} canPick={false} onPick={() => {}} />
      </Case>
      <Case title="Crowd reveal" note="What the room picked per question, with and without the answer key." wide>
        <Pick label="Answer key" value={res} options={[{ id: 'with', label: 'Results in' }, { id: 'none', label: 'No results yet' }]} onChange={setRes} />
        <div className="mt-3">
          <CrowdReveal key={res} config={cfg} entries={entries} results={results} />
        </div>
      </Case>
      <Case title="Results form" note="The host answer key over the fixture lineup. Pull from OpenF1 needs Mock Net on. Save writes to Firestore, do not press." wide>
        <ResultsForm config={cfg} resultsDoc={{ answers: mockResults(), source: 'lab', updatedAt: ts(nowMs) }} results={mockResults()} />
      </Case>
      <Case title="Roster logic" note="filterBookings, tally and tierCounts over four bookings (paid, checked in, reserved, cancelled)." wide>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, email, id" aria-label="Search bookings" className="min-h-8 rounded border border-line bg-base px-2 text-xs text-ink" />
        <div className="mt-2"><Pick label="Status" value={status} options={STATUS_FILTERS.map((f) => ({ id: f.value, label: f.label }))} onChange={setStatus} /></div>
        <ul className="mt-3 text-xs text-muted">
          {shown.map((b) => (
            <li key={b.id}><span className="text-ink">{b.buyerName}</span> · {b.tierId} × {b.qty} · {b.status}</li>
          ))}
          {shown.length === 0 && <li>No match.</li>}
        </ul>
        <Json label="tally" value={tally(bookings, event)} />
        <Json label="tier counts" value={tierCounts(bookings, event)} />
      </Case>
      <Case title="Check-in" note="A check-in is a 'scan' only for a camera read that matched the secret token; everything else is manual.">
        <ul className="font-mono text-xs text-muted">
          {([['camera', 'token'], ['camera', 'id'], ['typed', 'token'], ['typed', 'id']] as const).map(([s, m]) => (
            <li key={s + m}>{s} + {m} → <span className="text-ink">{checkInMethodFor(s, m)}</span></li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted">Lab clock {new Date(nowMs).toISOString()} · race {new Date(BASE_MS).toISOString()}</p>
      </Case>
      <Case title="Venue search" note="Search-as-you-type over the captured Places payloads (Mock Net on). Picking only fills local state.">
        <VenueSearch onPick={setPicked} />
        {picked != null && <Json label="picked venue" value={picked} />}
      </Case>
    </Grid>
  );
}
