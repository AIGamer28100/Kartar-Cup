import { Navigate, NavLink, Route, Routes } from 'react-router';
import { HostFrame } from '../pages/HostFrame';
import HostConsole from './HostConsole';
import SettingsPage from './settings/SettingsPage';

const tabCls =
  'inline-flex min-h-11 items-center px-3 text-muted hover:text-ink aria-[current=page]:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

/** Host area (already behind RequireHost). Lazy-loaded so guests never download it. */
export default function HostApp() {
  return (
    <HostFrame signedIn>
      <nav aria-label="Host sections" className="flex gap-2 border-b border-line py-2">
        <NavLink to="/host" end className={tabCls}>
          Console
        </NavLink>
        <NavLink to="/host/settings" className={tabCls}>
          Settings
        </NavLink>
      </nav>
      <Routes>
        <Route index element={<HostConsole />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/host" replace />} />
      </Routes>
    </HostFrame>
  );
}
