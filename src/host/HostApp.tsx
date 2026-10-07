import { Navigate, NavLink, Route, Routes } from 'react-router';
import { HostFrame } from '../pages/HostFrame';
import ActivityLog from './ActivityLog';
import BookingsAdmin, { BookingEventForm, BookingEventAttendees, BookingEventCards } from './bookings/BookingsAdmin';
import CheckinScanner from './CheckinScanner';
import ContentAdmin from './ContentAdmin';
import CupAdmin from './cup/CupAdmin';
import HostConsole from './HostConsole';
import SettingsPage from './settings/SettingsPage';
import UsersAdmin from './UsersAdmin';
import { useAuth } from '../lib/auth';

const tabCls =
  'inline-flex min-h-11 shrink-0 items-center whitespace-nowrap px-3 text-muted hover:text-ink aria-[current=page]:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

export default function HostApp() {
  const { access } = useAuth();
  return (
    <HostFrame signedIn>
      <nav aria-label="Host sections" className="flex gap-2 overflow-x-auto border-b border-line py-2">
        {access?.isHost && (
          <NavLink to="/host" end className={tabCls}>
            Console
          </NavLink>
        )}
        {access?.isHost && (
          <NavLink to="/host/settings" className={tabCls}>
            Settings
          </NavLink>
        )}
        <NavLink to="/host/bookings" className={tabCls}>
          Bookings
        </NavLink>
        {access?.isHost && (
          <NavLink to="/host/cup" className={tabCls}>
            Cup
          </NavLink>
        )}
        <NavLink to="/host/checkin" className={tabCls}>
          Check-in
        </NavLink>
        {access?.isHost && (
          <NavLink to="/host/activity" className={tabCls}>
            Activity
          </NavLink>
        )}
        {access?.isHost && (
          <NavLink to="/host/content" className={tabCls}>
            Content
          </NavLink>
        )}
        {access?.isHost && (
          <NavLink to="/host/users" className={tabCls}>
            People
          </NavLink>
        )}
      </nav>
      <Routes>
        {/* A venue_host runs bookings and check-in only: the quiz console, settings and activity are
            isHost-only in firestore.rules, so send them to bookings instead of a permission error. */}
        <Route index element={access?.isHost ? <HostConsole /> : <Navigate to="/host/bookings" replace />} />
        <Route path="settings" element={access?.isHost ? <SettingsPage /> : <Navigate to="/host/bookings" replace />} />
        <Route path="bookings" element={<BookingsAdmin />}>
          <Route path="new" element={<BookingEventForm />} />
          <Route path=":eventId/edit" element={<BookingEventForm />} />
          <Route path=":eventId/attendees" element={<BookingEventAttendees />} />
          <Route path=":eventId/cards" element={<BookingEventCards />} />
        </Route>
        <Route path="cup" element={<CupAdmin />} />
        <Route path="checkin" element={<CheckinScanner />} />
        <Route path="activity" element={access?.isHost ? <ActivityLog /> : <Navigate to="/host/bookings" replace />} />
        <Route path="content" element={<ContentAdmin />} />
        <Route path="users" element={<UsersAdmin />} />
        <Route path="*" element={<Navigate to="/host" replace />} />
      </Routes>
    </HostFrame>
  );
}