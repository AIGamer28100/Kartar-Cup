import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Armchair, Check, Eye, Flag, Flame, Lock, Repeat, Target, Ticket } from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import Skeleton, { Busy } from '../components/Skeleton';
import { watchOwnBookings } from '../lib/bookings';
import { listOwnEntries } from '../lib/db';
import type { Booking } from '../lib/types';
import { computeAchievements, computeStreaks } from './achievements';
import type { Achievement, AchievementIcon } from './achievements';
import type { OwnEntryRow } from './profileModel';

const ICONS: Record<AchievementIcon, Icon> = {
  flag: Flag,
  target: Target,
  eye: Eye,
  repeat: Repeat,
  flame: Flame,
  seat: Armchair,
  ticket: Ticket,
};

function Badge({ a }: { a: Achievement }) {
  const reduce = useReducedMotion();
  const Glyph = ICONS[a.icon];
  const have = a.progress?.have ?? 0;
  const need = a.progress?.need ?? 1;
  return (
    <li
      className={`flex gap-3 rounded-lg border p-3 ${
        a.earned ? 'border-accent bg-raised' : 'border-dashed border-line'
      }`}
    >
      {/* Shape differs by state (filled disc vs hollow ring) so state never rests on colour alone. */}
      <span
        aria-hidden="true"
        className={`flex size-11 shrink-0 items-center justify-center ${
          a.earned ? 'rounded-full bg-accent text-accent-ink' : 'rounded-md border border-line text-muted'
        }`}
      >
        <Glyph size={22} weight={a.earned ? 'fill' : 'regular'} />
      </span>
      <div className="min-w-0 flex-1">
        <p className={`font-medium ${a.earned ? 'text-ink' : 'text-muted'}`}>{a.label}</p>
        <p className="mt-0.5 text-sm text-muted">{a.description}</p>
        <p className="mt-2 flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest tabular-nums text-muted">
          {a.earned ? (
            <>
              <Check size={14} weight="bold" aria-hidden="true" />
              Earned
            </>
          ) : (
            <>
              <Lock size={14} weight="regular" aria-hidden="true" />
              Locked
              {a.progress && a.progress.need > 1 && (
                <span>
                  {' '}
                  · {have} of {need}
                </span>
              )}
            </>
          )}
        </p>
        {!a.earned && a.progress && a.progress.need > 1 && (
          <div
            role="progressbar"
            aria-label={`${a.label} progress`}
            aria-valuemin={0}
            aria-valuemax={need}
            aria-valuenow={have}
            aria-valuetext={`${have} of ${need}`}
            className="mt-2 flex gap-1"
          >
            {Array.from({ length: need }, (_, i) => (
              <motion.span
                key={i}
                initial={reduce ? false : { scaleX: 0.4, opacity: 0 }}
                animate={{ scaleX: 1, opacity: 1 }}
                transition={{ duration: reduce ? 0 : 0.25, delay: reduce ? 0 : i * 0.05 }}
                className={`h-1.5 flex-1 origin-left rounded-sm ${i < have ? 'bg-accent' : 'border border-line'}`}
              />
            ))}
          </div>
        )}
      </div>
    </li>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex-1 rounded-lg border border-line px-4 py-3">
      <p className="font-mono text-xs uppercase tracking-widest text-muted">{label}</p>
      <p className="mt-1 font-mono text-2xl tabular-nums text-ink">
        {value}
        <span className="ml-1 text-sm text-muted">{value === 1 ? 'event' : 'events'}</span>
      </p>
    </div>
  );
}

/** Own-data-only achievements + streaks (R15/R31), derived client-side from the guest's own quiz
 * entries and bookings. Nothing is written anywhere. */
export default function AchievementsSection({ uid }: { uid: string }) {
  const [rows, setRows] = useState<OwnEntryRow[] | undefined>(undefined);
  const [bookings, setBookings] = useState<Booking[] | undefined>(undefined);

  useEffect(() => {
    let live = true;
    setRows(undefined);
    listOwnEntries(uid)
      .then((r) => live && setRows(r))
      .catch(() => live && setRows([]));
    return () => {
      live = false;
    };
  }, [uid]);

  useEffect(
    () =>
      watchOwnBookings(
        uid,
        (b) => setBookings(b),
        () => setBookings([]),
      ),
    [uid],
  );

  if (rows === undefined || bookings === undefined) {
    return (
      <Busy>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </Busy>
    );
  }

  const list = computeAchievements(rows, bookings);
  const streaks = computeStreaks(rows);
  const earned = list.filter((a) => a.earned).length;

  return (
    <div>
      <p className="mt-1 text-sm text-muted">
        Built only from your own picks and tickets. Only you can see this.
      </p>
      {rows.length === 0 ? (
        <p className="mt-4 text-muted">Make your first prediction to start your streak.</p>
      ) : (
        <div className="mt-4 flex gap-3">
          <Stat label="Current streak" value={streaks.current} />
          <Stat label="Best streak" value={streaks.best} />
        </div>
      )}
      <p className="mt-4 font-mono text-xs uppercase tracking-widest tabular-nums text-muted">
        {earned} of {list.length} earned
      </p>
      <ul className="m-0 mt-3 grid list-none gap-3 p-0 sm:grid-cols-2">
        {list.map((a) => (
          <Badge key={a.id} a={a} />
        ))}
      </ul>
    </div>
  );
}

