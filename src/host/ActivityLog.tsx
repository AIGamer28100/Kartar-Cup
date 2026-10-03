import { useEffect, useState } from 'react';
import { RowsSkeleton } from '../components/Skeleton';
import { watchAuditLog, type AuditRow } from '../lib/audit';
import { fmtLocal } from './settings/time';

/** Plain-English labels so the log reads as a history, not as internal identifiers. */
const LABELS: Record<string, string> = {
  'event.save': 'Saved event settings',
  'event.go-live': 'Set the live event',
  'event.override': 'Changed picks override',
  'event.extend-closes': 'Moved the closing time',
  'event.set-lights-out': 'Set the lights-out time',
  'results.save': 'Saved race results',
  'winner.reveal': 'Revealed the winner',
  'booking-event.create': 'Created a booking event',
  'booking-event.update': 'Edited a booking event',
  'cup.season': 'Changed a Cup season',
  'cup.driver': 'Changed a Cup driver',
  'cup.round': 'Changed a Cup round',
  'cup.results': 'Saved Cup round results',
  'cup.standings': 'Recomputed Cup standings',
  'booking.check-in': 'Checked a guest in',
  'card.save': 'Saved an event card design',
  'card.delete': 'Deleted an event card design',
  'card.assign': 'Assigned a guest their VIP pass and Play card',
  'user.roles': 'Changed someone’s roles',
  'invite.create': 'Created an invite link',
  'invite.revoke': 'Revoked an invite link',
};

export default function ActivityLog() {
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(
    () =>
      watchAuditLog(
        (r) => {
          setFailed(false);
          setRows(r);
        },
        () => {
          setFailed(true);
          setRows([]);
        },
      ),
    [],
  );

  return (
    <section aria-label="Activity" className="py-6">
      <h2 className="text-2xl font-semibold md:text-3xl">Activity</h2>
      <p className="mt-1 max-w-2xl text-muted">
        The last 100 actions taken from the host console. Entries cannot be edited or deleted.
      </p>
      {rows === null ? (
        <RowsSkeleton />
      ) : failed ? (
        <p role="alert" className="mt-6 text-accent">
          Couldn&rsquo;t load the activity log. Try refreshing.
        </p>
      ) : rows.length === 0 ? (
        <p className="mt-6 text-muted">Nothing recorded yet.</p>
      ) : (
        <ol className="mt-6 divide-y divide-line border-y border-line">
          {rows.map((r) => (
            <li key={r.id} className="grid gap-x-6 gap-y-1 py-3 md:grid-cols-[11rem_1fr_16rem] md:items-baseline">
              <span className="font-mono text-sm text-muted">{fmtLocal(r.at.toMillis())}</span>
              <span>
                <span className="text-ink">{LABELS[r.action] ?? r.action}</span>
                <span className="ml-2 font-mono text-sm text-muted">{r.target}</span>
                {r.detail && <span className="mt-0.5 block text-sm text-muted">{r.detail}</span>}
              </span>
              <span className="truncate text-sm text-muted md:text-right">{r.actor}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
