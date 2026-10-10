import { useEffect, useMemo, useState } from 'react';
import { watchAllBookingEvents } from '../../lib/bookings';
import { watchEventResults } from '../../lib/db';
import { playUrl, watchPlayLinks, type PlayLink } from '../../lib/playLinks';
import { SECTION, quizPath } from '../nav';
import { useScreenData } from '../screen/useScreenData';
import type { OverlayData } from './LiveOverlay';
import { hasResults, topStandings } from './overlayModel';

/**
 * Everything the live overlay shows, for the active quiz: config and entry count (useScreenData),
 * the newest unrevoked play link, whether results are in (then the top 5), and, only when there is
 * no link yet, the watch party that owns the quiz so the overlay can deep-link its Quiz tab.
 */
export function useOverlayData(): OverlayData {
  const screen = useScreenData();
  const { eventId } = screen;
  const [answers, setAnswers] = useState<{ forId: string; answers: Record<string, string[]> | null } | null>(null);
  const [links, setLinks] = useState<{ forId: string; links: PlayLink[] } | null>(null);
  const [linkErr, setLinkErr] = useState<string | null>(null);
  const [bookingId, setBookingId] = useState<{ forId: string; id: string | null } | null>(null);

  useEffect(() => {
    if (!eventId) return;
    return watchEventResults(
      eventId,
      (r) => setAnswers({ forId: eventId, answers: r?.answers ?? null }),
      () => setAnswers({ forId: eventId, answers: null }),
    );
  }, [eventId]);

  useEffect(() => {
    if (!eventId) return;
    return watchPlayLinks(
      eventId,
      (l) => {
        setLinkErr(null);
        setLinks({ forId: eventId, links: l });
      },
      (e) => setLinkErr(e.message),
    );
  }, [eventId]);

  const currentLinks = links && links.forId === eventId ? links.links : null;
  const noLink = !!eventId && currentLinks !== null && currentLinks.length === 0;

  useEffect(() => {
    if (!eventId || !noLink) return;
    return watchAllBookingEvents(
      (evs) => setBookingId({ forId: eventId, id: evs.find((e) => e.quizEventId === eventId)?.id ?? null }),
      () => setBookingId({ forId: eventId, id: null }),
    );
  }, [eventId, noLink]);

  return useMemo<OverlayData>(() => {
    const owner = bookingId && bookingId.forId === eventId ? bookingId.id : null;
    const resultsIn = !!answers && answers.forId === eventId && hasResults(answers.answers);
    return {
      loading: screen.loading || (!!eventId && currentLinks === null && !linkErr),
      error: screen.error ?? linkErr,
      quiz: screen.config
        ? {
            name: screen.config.name,
            opensAt: screen.config.opensAt,
            closesAt: screen.config.closesAt,
            override: screen.config.override,
            winnerRevealed: screen.config.winnerRevealed,
          }
        : null,
      joinUrl: currentLinks && currentLinks[0] ? playUrl(currentLinks[0].token) : null,
      quizTabHref: owner ? quizPath(owner) : `/host/${SECTION.bookings}`,
      entryCount: screen.entryCount,
      standings: resultsIn ? topStandings(screen.ranked) : null,
    };
  }, [screen.loading, screen.error, screen.config, screen.entryCount, screen.ranked, eventId, currentLinks, linkErr, answers, bookingId]);
}
