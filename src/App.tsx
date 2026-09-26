import { lazy, Suspense } from 'react';
import Skeleton from './components/Skeleton';

const GuestApp = lazy(() => import('./guest/GuestApp'));
const HostApp = lazy(() => import('./host/HostApp'));

export default function App() {
  const isHost = window.location.pathname.startsWith('/host');
  return (
    <div className="min-h-[100dvh] bg-base text-ink">
      <Suspense fallback={<Skeleton className="m-6 h-40" />}>
        {isHost ? <HostApp /> : <GuestApp />}
      </Suspense>
    </div>
  );
}
