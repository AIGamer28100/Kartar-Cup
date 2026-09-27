import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import FailurePage from '../components/FailurePage';
import { RowsSkeleton } from '../components/Skeleton';
import { useAuth } from '../lib/auth';
import { decideRoute } from '../lib/routing';
import { useTimedOut } from '../lib/useTimedOut';
import { HostFrame, HostGate } from './HostFrame';

/** Host-only guard. Shows a skeleton (never host UI) until the allowlist lookup resolves. */
export default function RequireHost({ children }: { children: ReactNode }) {
  const { ready, user, isHost, hostError } = useAuth();
  const { pathname } = useLocation();
  const d = decideRoute({ path: pathname, user: !!user, isHost, loading: !ready });
  const stuck = useTimedOut(d.kind === 'loading');
  if (hostError) return <FailurePage error={hostError} />;
  if (d.kind === 'redirect') return <Navigate to={d.to} replace />;
  if (d.kind === 'signin')
    return (
      <HostFrame signedIn={false}>
        <HostGate />
      </HostFrame>
    );
  if (d.kind === 'loading')
    return stuck ? (
      <FailurePage error="The marshal list did not answer in time." />
    ) : (
      <HostFrame signedIn={!!user}>
        <RowsSkeleton />
      </HostFrame>
    );
  return <>{children}</>;
}
