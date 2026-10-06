import { lazy, Suspense } from 'react';
import { Route, Routes, useLocation } from 'react-router';
import { PageSkeleton } from './components/Skeleton';
import LogoutPage from './pages/LogoutPage';
import NotFoundPage from './pages/NotFoundPage';
import RequireHost from './pages/RequireHost';
import FailurePage from './components/FailurePage';
import TransitionLayer from './guest/transitions/TransitionLayer';
import MobileNav from './guest/MobileNav';
import { chromeVisible } from './guest/mobileChrome';

const HomePage = lazy(() => import('./guest/HomePage'));
const EventsPage = lazy(() => import('./guest/EventsPage'));
const BookingCheckout = lazy(() => import('./guest/BookingCheckout'));
const GalleryPage = lazy(() => import('./guest/GalleryPage'));
const CupPage = lazy(() => import('./guest/CupPage'));
const RaceDetailPage = lazy(() => import('./guest/RaceDetailPage'));
const ProfilePage = lazy(() => import('./guest/ProfilePage'));
const RaceStateMockPage = lazy(() => import('./pages/RaceStateMockPage'));
const TicketPage = lazy(() => import('./guest/TicketView'));
const AboutPage = lazy(() => import('./guest/AboutPage'));
const ContactPage = lazy(() => import('./guest/ContactPage'));
const PartnersPage = lazy(() => import('./guest/ContentPages').then((m) => ({ default: m.PartnersPage })));
const StoriesPage = lazy(() => import('./guest/ContentPages').then((m) => ({ default: m.StoriesPage })));
const TermsPage = lazy(() => import('./guest/LegalPages').then((m) => ({ default: m.TermsPage })));
const PrivacyPage = lazy(() => import('./guest/LegalPages').then((m) => ({ default: m.PrivacyPage })));
const JoinPage = lazy(() => import('./pages/JoinPage'));
const HostApp = lazy(() => import('./host/HostApp'));
const ScreenApp = lazy(() => import('./host/screen/ScreenApp'));

export default function App() {
  const { pathname } = useLocation();
  return (
    <div className={`min-h-[100dvh] bg-base text-ink ${chromeVisible(pathname) ? 'max-md:pb-[calc(6.5rem+env(safe-area-inset-bottom))]' : ''}`}>
      <TransitionLayer>
        {(location) => (
          <Suspense fallback={<PageSkeleton />}>
            <Routes location={location}>
              <Route path="/" element={<HomePage />} />
              <Route path="/events" element={<EventsPage />} />
              <Route path="/events/:bookingEventId" element={<BookingCheckout />} />
              <Route path="/races/:raceId" element={<RaceDetailPage />} />
              <Route path="/gallery" element={<GalleryPage />} />
              <Route path="/cup" element={<CupPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/race-state-mock" element={<RaceStateMockPage />} />
              <Route path="/tickets/:bookingId" element={<TicketPage />} />
              <Route path="/join/:token" element={<JoinPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/partners" element={<PartnersPage />} />
              <Route path="/stories" element={<StoriesPage />} />
              <Route path="/stories/:storyId" element={<StoriesPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
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
      <MobileNav />
    </div>
  );
}
