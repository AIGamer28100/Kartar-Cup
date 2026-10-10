import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { HostFrame } from '../pages/HostFrame';
import ActivityLog from './ActivityLog';
import BookingsAdmin, { BookingEventForm, BookingEventAttendees, BookingEventCards } from './bookings/BookingsAdmin';
import { BookingEventQuiz, BookingEventQuizResults } from './bookings/QuizSetup';
import CheckinScanner from './CheckinScanner';
import ContentAdmin, { ContentLegalTab, ContentPartnersTab, ContentStoriesTab } from './ContentAdmin';
import CupAdmin from './cup/CupAdmin';
import HostConsole from './HostConsole';
import { HostBurger, HostDrawer, useHostDrawer } from './HostDrawer';
import { CONTENT_TABS, QUIZ_RESULTS, QUIZ_TABS, SECTION, visibleNav } from './nav';
import {
  SettingsDetailsTab,
  SettingsGridTab,
  SettingsQuestionsTab,
  SettingsTeamsTab,
} from './settings/SettingsPage';
import UsersAdmin from './UsersAdmin';
import { OverlayPage, OverlayProvider } from './overlay/OverlayProvider';
import { useAuth } from '../lib/auth';

export default function HostApp() {
  const { access } = useAuth();
  const isHost = !!access?.isHost;
  const items = visibleNav(isHost);
  const drawer = useHostDrawer();
  /** isHost-only screens: a venue_host is sent to bookings instead of a permission error (firestore.rules). */
  const hostOnly = (el: ReactNode) => (isHost ? el : <Navigate to="/host/bookings" replace />);

  const framed = (
    <HostFrame
      signedIn
      drawerOpen={drawer.open}
      leading={<HostBurger state={drawer} />}
      aside={<HostDrawer items={items} state={drawer} />}
    >
      <div className="min-w-0">
        <Routes>
          <Route index element={hostOnly(<HostConsole />)} />
          <Route path={SECTION.more} element={<Navigate to="/host" replace />} />
          {/* R57: the global quiz editor moved into each booking event; old bookmarks land on the list. */}
          <Route path={`${SECTION.settings}/*`} element={<Navigate to={`/host/${SECTION.bookings}`} replace />} />
          <Route path={SECTION.bookings} element={<BookingsAdmin />}>
            <Route path="new" element={<BookingEventForm />} />
            <Route path=":eventId/edit" element={<BookingEventForm />} />
            <Route path=":eventId/attendees" element={<BookingEventAttendees />} />
            <Route path=":eventId/cards" element={<BookingEventCards />} />
            {/* Quiz editor (tabs share one form held by the layout) and, beside it, the results key. */}
            <Route path=":eventId/quiz" element={hostOnly(<BookingEventQuiz />)}>
              <Route index element={<Navigate to={QUIZ_TABS[0].id} replace />} />
              <Route path="details" element={<SettingsDetailsTab />} />
              <Route path="grid" element={<SettingsGridTab />} />
              <Route path="teams" element={<SettingsTeamsTab />} />
              <Route path="questions" element={<SettingsQuestionsTab />} />
            </Route>
            <Route path={`:eventId/quiz/${QUIZ_RESULTS.id}`} element={hostOnly(<BookingEventQuizResults />)} />
          </Route>
          <Route path={SECTION.league}>
            <Route index element={<CupAdmin />} />
            <Route path=":seasonId" element={<CupAdmin />} />
          </Route>
          <Route path="cup" element={<Navigate to={`/host/${SECTION.league}`} replace />} />
          <Route path={SECTION.checkin} element={<CheckinScanner />} />
          <Route path={SECTION.auditLog} element={hostOnly(<ActivityLog />)} />
          <Route path="activity" element={<Navigate to={`/host/${SECTION.auditLog}`} replace />} />
          <Route path={SECTION.content} element={<ContentAdmin />}>
            <Route index element={<Navigate to={CONTENT_TABS[0].id} replace />} />
            <Route path="partners" element={<ContentPartnersTab />} />
            <Route path="stories" element={<ContentStoriesTab />} />
            <Route path="legal" element={<ContentLegalTab />} />
          </Route>
          <Route path={SECTION.users} element={<UsersAdmin />} />
          <Route path="*" element={<Navigate to="/host" replace />} />
        </Routes>
      </div>
    </HostFrame>
  );

  // The live overlay is mounted once here so it outlives navigation between host pages. Its popup
  // fallback (/host/overlay) renders only the overlay: no HostFrame, no drawer.
  return (
    <OverlayProvider>
      <Routes>
        <Route path="overlay" element={hostOnly(<OverlayPage />)} />
        <Route path="*" element={framed} />
      </Routes>
    </OverlayProvider>
  );
}
