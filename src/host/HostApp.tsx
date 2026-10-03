import { Navigate, NavLink, Route, Routes } from 'react-router';
import { HostFrame } from '../pages/HostFrame';
import { useAuth } from '../lib/auth';
import ActivityLog from './ActivityLog';
import BookingsAdmin from './bookings/BookingsAdmin';
import CheckinScanner from './CheckinScanner';
import ContentAdmin from './ContentAdmin';
import CupAdmin from './cup/CupAdmin';
import HostConsole from './HostConsole';
import SettingsPage from './settings/SettingsPage';
import UsersAdmin from './UsersAdmin';

const tabCls =
  'inline-flex min-h-11 items-center px-3 text-muted hover:text-ink aria-[current=page]:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

/** Host area (already behind RequireHost). Lazy-loaded so guests never download it. */
export default function HostApp() {
  const { access } = useAuth();
  return (
    <HostFrame signedIn>
      <nav aria-label="Host sections" className="flex gap-2 border-b border-line py-2">
        <NavLink to="/host" end className={tabCls}>
          Console
        </NavLink>
        <NavLink to="/host/settings" className={tabCls}>
          Settings
        </NavLink>
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
        <NavLink to="/host/activity" className={tabCls}>
          Activity
        </NavLink>
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
        <Route index element={<HostConsole />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="bookings" element={<BookingsAdmin />} />
        {access?.isHost && <Route path="cup" element={<CupAdmin />} />}
        <Route path="checkin" element={<CheckinScanner />} />
        <Route path="activity" element={<ActivityLog />} />
        {access?.isHost && <Route path="content" element={<ContentAdmin />} />}
        {access?.isHost && <Route path="users" element={<UsersAdmin />} />}
        <Route path="*" element={<Navigate to="/host" replace />} />
      </Routes>
    </HostFrame>
  );
}
