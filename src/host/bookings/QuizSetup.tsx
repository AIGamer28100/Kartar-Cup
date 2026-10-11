import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ArrowLeft } from '@phosphor-icons/react';
import FailurePage from '../../components/FailurePage';
import { RowsSkeleton } from '../../components/Skeleton';
import { getEventConfig, newEventId, saveEventConfig, watchEventConfig, watchEventResults } from '../../lib/db';
import { getBookingEvent, updateBookingEvent } from '../../lib/bookings';
import type { EventConfig, Results, ResultsDoc } from '../../lib/types';
import { EventMissing, useBookingEventById } from './BookingsAdmin';
import { ensureQuizForBookingEvent, type QuizLinkDeps } from './quizLink';
import QuizShare from './QuizShare';
import ResultsForm from '../ResultsForm';
import SettingsPage from '../settings/SettingsPage';
import { QuizTabs } from '../settings/QuizTabs';
import { SECTION, quizPath } from '../nav';

const defaultDeps: QuizLinkDeps = {
  newQuizId: newEventId,
  getBookingEvent,
  getQuiz: getEventConfig,
  saveQuiz: saveEventConfig,
  linkQuiz: (bookingEventId, quizEventId) => updateBookingEvent(bookingEventId, { quizEventId }),
};

/** Layout route `bookings/:eventId/quiz` (R57): finds this watch party's own quiz, creating it the first time the
 * Quiz tab opens, then renders the editor (whose tab routes share one lifted form). */
export function BookingEventQuiz() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const event = useBookingEventById(eventId);
  const [created, setCreated] = useState<{ forEvent: string; quizId: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const needsQuiz = event ? !event.quizEventId : false;
  useEffect(() => {
    if (!event || event.quizEventId) return;
    let live = true;
    ensureQuizForBookingEvent(event, defaultDeps).then(
      (quizId) => live && setCreated({ forEvent: event.id, quizId }),
      (e) => live && setError(e instanceof Error ? e.message : 'Could not create the quiz.'),
    );
    return () => {
      live = false;
    };
    // Keyed on identity only: later snapshots of the same event must not restart the creation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.id, needsQuiz]);

  if (event === undefined) return <RowsSkeleton />;
  if (event === null) return <EventMissing onBack={() => navigate(`/host/${SECTION.bookings}`, { replace: true })} />;
  if (error) return <FailurePage error={error} />;
  const quizId = event.quizEventId ?? (created?.forEvent === event.id ? created.quizId : undefined);
  if (!quizId) return <RowsSkeleton />;
  return (
    <>
      <QuizShare quizId={quizId} />
      <SettingsPage key={quizId} bookingEventId={event.id} quizId={quizId} title={event.title} />
    </>
  );
}

/** `bookings/:eventId/quiz/results`: the answer key for THIS watch party's quiz. It never creates a quiz. */
export function BookingEventQuizResults() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const event = useBookingEventById(eventId);
  const quizId = event?.quizEventId;
  const [config, setConfig] = useState<EventConfig | null | undefined>(undefined);
  const [resultsDoc, setResultsDoc] = useState<ResultsDoc | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setConfig(undefined);
    setResultsDoc(null);
    if (!quizId) return;
    const u1 = watchEventConfig(quizId, setConfig, (e) => setError(e.message));
    const u2 = watchEventResults(quizId, setResultsDoc, (e) => setError(e.message));
    return () => {
      u1();
      u2();
    };
  }, [quizId]);

  const results: Results = useMemo(() => {
    const base = config ? Object.fromEntries(config.questionIds.map((id) => [id, [] as string[]])) : {};
    return { ...base, ...(resultsDoc?.answers ?? {}) };
  }, [config, resultsDoc]);

  if (event === undefined) return <RowsSkeleton />;
  if (event === null) return <EventMissing onBack={() => navigate(`/host/${SECTION.bookings}`, { replace: true })} />;
  if (error) return <FailurePage error={error} />;

  return (
    <div className="pb-6">
      <div className="pt-4">
        <Link
          to={`/host/${SECTION.bookings}`}
          className="inline-flex min-h-11 items-center gap-2 text-muted transition hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <ArrowLeft size={20} weight="regular" aria-hidden="true" /> Booking events
        </Link>
      </div>
      <h2 className="text-2xl font-semibold md:text-3xl">Quiz</h2>
      <p className="mt-1 text-muted">{event.title}</p>
      <div className="mt-4">
        <QuizTabs eventId={event.id} />
      </div>
      {!quizId ? (
        <p className="py-8 text-muted">
          This event has no quiz yet. <Link className="underline hover:text-ink" to={quizPath(event.id)}>Set up the quiz</Link> first.
        </p>
      ) : config === undefined ? (
        <RowsSkeleton />
      ) : (
        <ResultsForm eventId={quizId} config={config} resultsDoc={resultsDoc} results={results} />
      )}
    </div>
  );
}
