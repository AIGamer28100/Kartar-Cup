import { useEffect, useState } from 'react';
import { Navigate } from 'react-router';
import { ArrowRight, QrCode, SignOut, Ticket as TicketIcon, Trophy } from '@phosphor-icons/react';
import { Link } from 'react-router';
import Divider from '../components/Divider';
import Skeleton, { Busy, PageSkeleton } from '../components/Skeleton';
import { useAuth } from '../lib/auth';
import { watchBookingEvent, watchOwnBookings } from '../lib/bookings';
import { listOwnEntries } from '../lib/db';
import { useTimedOut } from '../lib/useTimedOut';
import type { Booking, BookingEvent } from '../lib/types';
import { accountName } from './SignIn';
import { bookingStatusLabel, entryStatusLabel, formatInr, initials, sortOwnEntries } from './profileModel';
import type { OwnEntryRow } from './profileModel';
import { Eyebrow, PageTitle, Reveal, Shell } from './parts';

function Avatar({ photoUrl, name, email }: { photoUrl?: string | null; name: string; email?: string | null }) {
  const [broken, setBroken] = useState(false);
  if (photoUrl && !broken) {
    return (
      <img
        src={photoUrl}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
        className="size-16 shrink-0 rounded-full border border-line object-cover md:size-20"
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="flex size-16 shrink-0 items-center justify-center rounded-full border border-line bg-raised font-mono text-lg text-muted md:size-20"
    >
      {initials(name, email)}
    </span>
  );
}

function EntryRowSkeleton() {
  return (
    <div className="flex items-baseline justify-between gap-4 py-4">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-4 w-28" />
    </div>
  );
}

function QuizHistory({ uid }: { uid: string }) {
  const [rows, setRows] = useState<OwnEntryRow[] | undefined>(undefined);
  const [err, setErr] = useState<Error | null>(null);

  useEffect(() => {
    let live = true;
    setRows(undefined);
    setErr(null);
    listOwnEntries(uid)
      .then((r) => live && setRows(r))
      .catch((e: unknown) => {
        if (!live) return;
        setErr(e instanceof Error ? e : new Error('Could not load your quiz history.'));
        setRows([]);
      });
    return () => {
      live = false;
    };
  }, [uid]);

  const stuck = useTimedOut(rows === undefined && !err);

  if (rows === undefined) {
    return (
      <Busy>
        {stuck ? (
          <p className="py-6 text-sm text-muted">Still waiting on your quiz history — try refreshing.</p>
        ) : (
          Array.from({ length: 2 }, (_, i) => <EntryRowSkeleton key={i} />)
        )}
      </Busy>
    );
  }
  if (err) return <p className="py-6 text-sm text-muted">Couldn&rsquo;t load your quiz history right now.</p>;
  if (rows.length === 0) {
    return <p className="py-6 text-muted">No quiz entries yet — enter picks next time an event is live.</p>;
  }
  const sorted = sortOwnEntries(rows);
  return (
    <ul className="m-0 list-none p-0">
      {sorted.map((row, i) => (
        <li key={row.eventId}>
          {i > 0 && <Divider />}
          <div className="flex flex-wrap items-baseline justify-between gap-2 py-4">
            <p className="font-medium text-ink">{row.eventName}</p>
            <p className="font-mono text-sm text-muted">{entryStatusLabel(row)}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function BookingRow({ booking, index }: { booking: Booking; index: number }) {
  const [ev, setEv] = useState<BookingEvent | null | undefined>(undefined);
  useEffect(() => watchBookingEvent(booking.bookingEventId, setEv, () => setEv(null)), [booking.bookingEventId]);
  const tierLabel = ev?.tiers.find((t) => t.id === booking.tierId)?.label ?? booking.tierId;
  return (
    <Reveal index={index}>
      {index > 0 && <Divider />}
      <Link
        to={`/tickets/${booking.id}`}
        aria-label={`Open ticket for ${ev?.title ?? 'watch party'}`}
        className="group -mx-3 flex flex-wrap items-start justify-between gap-4 rounded-lg px-3 py-4 transition hover:bg-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <div>
          <p className="font-medium text-ink">
            {ev === undefined ? <Skeleton className="h-5 w-40" /> : ev?.title ?? 'Watch party'}
          </p>
          <p className="mt-1 text-sm text-muted">
            {tierLabel} · Qty {booking.qty} · {formatInr(booking.totalInr)}
          </p>
          <p className="mt-1 flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted">
            <QrCode size={16} weight="regular" aria-hidden="true" />
            <span>{booking.id}</span>
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <p className="font-mono text-xs uppercase tracking-widest text-muted">
            {bookingStatusLabel(booking.status)}
          </p>
          <p className="inline-flex items-center gap-1 text-sm font-medium text-accent">
            Show ticket
            <ArrowRight size={16} weight="regular" aria-hidden="true" className="transition group-hover:translate-x-0.5" />
          </p>
        </div>
      </Link>
    </Reveal>
  );
}

function Bookings({ uid }: { uid: string }) {
  const [bookings, setBookings] = useState<Booking[] | undefined>(undefined);
  const [err, setErr] = useState<Error | null>(null);

  useEffect(
    () =>
      watchOwnBookings(
        uid,
        (b) => setBookings(b),
        (e) => {
          setErr(e);
          setBookings([]);
        },
      ),
    [uid],
  );

  const stuck = useTimedOut(bookings === undefined && !err);

  if (bookings === undefined) {
    return (
      <Busy>
        {stuck ? (
          <p className="py-6 text-sm text-muted">Still waiting on your bookings — try refreshing.</p>
        ) : (
          Array.from({ length: 2 }, (_, i) => <EntryRowSkeleton key={i} />)
        )}
      </Busy>
    );
  }
  if (err) return <p className="py-6 text-sm text-muted">Couldn&rsquo;t load your bookings right now.</p>;
  if (bookings.length === 0) {
    return <p className="py-6 text-muted">No bookings yet — grab a ticket from the events page.</p>;
  }
  return (
    <div>
      {bookings.map((b, i) => (
        <BookingRow key={b.id} booking={b} index={i} />
      ))}
    </div>
  );
}

/** Signed-in guest's own profile (R31): identity, own quiz history, own bookings — never another
 * guest's data (R15). Route itself redirects signed-out visitors home (no page-wide sign-in gate,
 * R28); the header's general sign-in button lands here afterwards. */
export default function ProfilePage() {
  const { ready, user } = useAuth();

  if (!ready) return <PageSkeleton />;
  if (!user) return <Navigate to="/" replace />;

  const name = accountName(user);

  return (
    <Shell>
      <Reveal>
        <Eyebrow>Your account</Eyebrow>
        <h1 className={`mt-3 ${PageTitle}`}>Profile</h1>
      </Reveal>

      <Reveal index={1} className="mt-8 flex flex-wrap items-center gap-5">
        <Avatar photoUrl={user.photoURL} name={name} email={user.email} />
        <div className="min-w-0">
          <p className="truncate text-lg font-medium text-ink">{name}</p>
          {user.email && <p className="truncate font-mono text-sm text-muted">{user.email}</p>}
        </div>
        <Link to="/logout" className="-mr-2 ml-auto inline-flex min-h-11 items-center gap-2 px-2 text-sm text-muted transition hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
          <SignOut size={20} weight="regular" aria-hidden="true" />
          Sign out
        </Link>
      </Reveal>

      <Divider className="mt-10" />
      <Reveal index={2} className="mt-8">
        <h2 className="flex items-center gap-2 text-lg font-medium text-ink">
          <Trophy size={20} weight="regular" aria-hidden="true" />
          Quiz history
        </h2>
        <QuizHistory uid={user.uid} />
      </Reveal>

      <Divider className="mt-4" />
      <Reveal index={3} className="mt-8">
        <h2 className="flex items-center gap-2 text-lg font-medium text-ink">
          <TicketIcon size={20} weight="regular" aria-hidden="true" />
          Bookings
        </h2>
        <Bookings uid={user.uid} />
      </Reveal>
    </Shell>
  );
}
