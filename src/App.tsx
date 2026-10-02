import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router';
import { PageSkeleton } from './components/Skeleton';
import LogoutPage from './pages/LogoutPage';
import NotFoundPage from './pages/NotFoundPage';
import RequireHost from './pages/RequireHost';
import FailurePage from './components/FailurePage';
import TransitionLayer from './guest/transitions/TransitionLayer';

const HomePage = lazy(() => import('./guest/HomePage'));
const EventsPage = lazy(() => import('./guest/EventsPage'));
const BookingCheckout = lazy(() => import('./guest/BookingCheckout'));
const GalleryPage = lazy(() => import('./guest/GalleryPage'));
const ProfilePage = lazy(() => import('./guest/ProfilePage'));
const TicketPage = lazy(() => import('./guest/TicketView'));
const AboutPage = lazy(() => import('./guest/AboutPage'));
const ContactPage = lazy(() => import('./guest/ContactPage'));
const JoinPage = lazy(() => import('./pages/JoinPage'));
const HostApp = lazy(() => import('./host/HostApp'));
const ScreenApp = lazy(() => import('./host/screen/ScreenApp'));

export default function App() {
  return (
    <div className="min-h-[100dvh] bg-base text-ink">
      <TransitionLayer>
        {(location) => (
          <Suspense fallback={<PageSkeleton />}>
            <Routes location={location}>
              <Route path="/" element={<HomePage />} />
              <Route path="/events" element={<EventsPage />} />
              <Route path="/events/:bookingEventId" element={<BookingCheckout />} />
              <Route path="/gallery" element={<GalleryPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/tickets/:bookingId" element={<TicketPage />} />
              <Route path="/join/:token" element={<JoinPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route
                path="/host/screen"
                element={
                  <RequireHost>
                    <ScreenApp />
                  </RequireHost>
                }
              />
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
        )}
      </TransitionLayer>
    </div>
  );
}
