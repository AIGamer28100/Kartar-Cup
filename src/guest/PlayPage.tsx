import { lazy, useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { PageSkeleton } from '../components/Skeleton';
import { isPlayToken, resolvePlayLink } from '../lib/playLinks';
import { usePageMeta } from '../lib/pageMeta';
import { Shell } from './parts';

const GuestApp = lazy(() => import('./GuestApp'));

type State = { kind: 'loading' } | { kind: 'invalid' } | { kind: 'ok'; eventId: string };

/** /play/:token - the private quiz page. The quiz is only reachable through the host's link. */
export default function PlayPage() {
  const { token = '' } = useParams<{ token: string }>();
  usePageMeta({ title: 'Quiz', noindex: true });
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    if (!isPlayToken(token)) {
      setState({ kind: 'invalid' });
      return;
    }
    let live = true;
    setState({ kind: 'loading' });
    resolvePlayLink(token).then(
      (l) => live && setState(l ? { kind: 'ok', eventId: l.eventId } : { kind: 'invalid' }),
      () => live && setState({ kind: 'invalid' }),
    );
    return () => {
      live = false;
    };
  }, [token]);

  if (state.kind === 'loading') return <PageSkeleton />;
  if (state.kind === 'invalid')
    return (
      <Shell>
        <div className="py-24 text-center">
          <p role="alert" className="text-lg text-ink">
            This quiz link is not active. Ask the host for the current link.
          </p>
        </div>
      </Shell>
    );
  return <GuestApp eventId={state.eventId} accessToken={token} />;
}
