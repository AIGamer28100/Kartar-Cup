import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router';
import { PageSkeleton } from './components/Skeleton';
import LogoutPage from './pages/LogoutPage';
import NotFoundPage from './pages/NotFoundPage';
import RequireHost from './pages/RequireHost';
import FailurePage from './components/FailurePage';

const HomePage = lazy(() => import('./guest/HomePage'));
const EventsPage = lazy(() => import('./guest/EventsPage'));
const HostApp = lazy(() => import('./host/HostApp'));

export default function App() {
  return (
    <div className="min-h-[100dvh] bg-base text-ink">
      <Suspense fallback={<PageSkeleton />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/events" element={<EventsPage />} />
          <Route
            path="/host/*"
            element={
              <RequireHost>
                <HostApp />
              </RequireHost>
            }
          />
          <Route path="/logout" element={<LogoutPage />} />
          <Route path="/error" element={<FailurePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </div>
  );
}
