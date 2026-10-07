import { lazy, Suspense } from 'react';
import { Route, Routes, useLocation } from 'react-router';
import { PageSkeleton, RouteSkeleton } from './components/Skeleton';
import { load } from './routes';
import { isPublicPath } from './guest/transitions/variants';
import LogoutPage from './pages/LogoutPage';
import NotFoundPage from './pages/NotFoundPage';
import RequireHost from './pages/RequireHost';
import FailurePage from './components/FailurePage';
import TransitionLayer from './guest/transitions/TransitionLayer';
import MobileNav from './guest/MobileNav';
import { chromeVisible } from './guest/mobileChrome';

const HomePage = lazy(load.home);
const EventsPage = lazy(load.events);
const BookingCheckout = lazy(load.checkout);
const GalleryPage = lazy(load.gallery);
const CupPage = lazy(load.cup);
const RaceDetailPage = lazy(load.race);
const ProfilePage = lazy(load.profile);
const RaceStateMockPage = lazy(() => import('./pages/RaceStateMockPage'));
const TicketPage = lazy(load.ticket);
const AboutPage = lazy(load.about);
const ContactPage = lazy(load.contact);
const PartnersPage = lazy(() => load.content().then((m) => ({ default: m.PartnersPage })));
const StoriesPage = lazy(() => load.content().then((m) => ({ default: m.StoriesPage })));
const TermsPage = lazy(() => load.legal().then((m) => ({ default: m.TermsPage })));
const PrivacyPage = lazy(() => load.legal().then((m) => ({ default: m.PrivacyPage })));
const JoinPage = lazy(load.join);
const HostApp = lazy(() => import('./host/HostApp'));
const ScreenApp = lazy(() => import('./host/screen/ScreenApp'));

export default function App() {
  const { pathname } = useLocation();
  return (
    <div className={`min-h-[100dvh] bg-base text-ink ${chromeVisible(pathname) ? 'max-md:pb-[calc(6.5rem+env(safe-area-inset-bottom))]' : ''}`}>
      <TransitionLayer>
        {(location) => (
          <Suspense fallback={isPublicPath(location.pathname) ? <RouteSkeleton /> : <PageSkeleton />}>
            <Routes location={location}>
              <Route path="/" element={<HomePage />} />
              <Route path="/events" element={<EventsPage />} />
              <Route path="/events/:bookingEventId" element={<BookingCheckout />} />
              <Route path="/races/:raceId" element={<RaceDetailPage />} />
              <Route path="/gallery" element={<GalleryPage />} />
              <Route path="/cup" element={<CupPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              {import.meta.env.DEV && <Route path="/race-state-mock" element={<RaceStateMockPage />} />}
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
