import { useState } from 'react';
import { CalendarPlus, ShareNetwork } from '@phosphor-icons/react';
import type { BookingEvent } from '../lib/types';
import { googleCalendarUrl, icsFile } from './bookingModel';

/** The host's cancellation/refund wording, shown before payment and again on the ticket so the
 * terms are never hidden behind a link. */
export function PolicyNote({ policy }: { policy: string }) {
  return (
    <div className="rounded-lg border border-line px-4 py-3">
      <p className="font-mono text-xs uppercase tracking-widest text-muted">Cancellations &amp; refunds</p>
      <p className="mt-1 text-sm text-ink">{policy}</p>
    </div>
  );
}

const btn =
  'inline-flex min-h-12 items-center gap-2 rounded-lg border border-line bg-raised px-5 text-[1rem] font-medium text-ink transition duration-150 hover:border-muted active:translate-y-px active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

/** Add-to-calendar (Google link + .ics for Apple/Outlook) and share, for a purchased ticket.
 * All client-side: a URL, a generated file, and the browser's own share sheet. */
export default function TicketActions({ event, bookingId }: { event: BookingEvent; bookingId: string }) {
  const [note, setNote] = useState('');
  const startMs = new Date(event.dateUtc).getTime();
  const cal = {
    title: event.title,
    startMs,
    location: `${event.venue.name}, ${event.venue.city}`,
    details: `Your Kartar CUP ticket: ${window.location.origin}/tickets/${bookingId}`,
  };

  function downloadIcs() {
    const blob = new Blob([icsFile({ ...cal, uid: bookingId })], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'kartar-cup-watch-party.ics';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function share() {
    // Shares the event page, never the ticket: the ticket's QR is the entry pass.
    const url = `${window.location.origin}/events/${event.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: event.title, text: `Join me at ${event.title}`, url });
      } else {
        await navigator.clipboard.writeText(url);
        setNote('Link copied.');
      }
    } catch {
      /* the user closed the share sheet: nothing to report */
    }
  }

  if (Number.isNaN(startMs)) return null;
  return (
    <div>
      <div className="flex flex-wrap gap-3">
        <a href={googleCalendarUrl(cal)} target="_blank" rel="noopener noreferrer" className={btn}>
          <CalendarPlus size={20} weight="regular" aria-hidden="true" />
          Add to Google Calendar
        </a>
        <button type="button" onClick={downloadIcs} className={btn}>
          <CalendarPlus size={20} weight="regular" aria-hidden="true" />
          Apple / Outlook (.ics)
        </button>
        <button type="button" onClick={() => void share()} className={btn}>
          <ShareNetwork size={20} weight="regular" aria-hidden="true" />
          Invite a friend
        </button>
      </div>
      <p role="status" className="mt-2 min-h-5 text-sm text-muted">
        {note}
      </p>
    </div>
  );
}
