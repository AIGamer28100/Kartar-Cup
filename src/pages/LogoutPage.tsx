import { useEffect, useState } from 'react';
import { House } from '@phosphor-icons/react';
import { Link, useNavigate } from 'react-router';
import { buttonCls } from '../components/Button';
import { PageSkeleton } from '../components/Skeleton';
import { Eyebrow, PageTitle, Reveal, Shell, Split } from '../guest/parts';
import { signOutUser } from '../lib/firebase';

const SECONDS = 5;

export default function LogoutPage() {
  const [done, setDone] = useState(false);
  const [left, setLeft] = useState(SECONDS);
  const navigate = useNavigate();

  useEffect(() => {
    let live = true;
    signOutUser()
      .catch((e) => console.error('[auth] sign-out failed', e))
      .finally(() => live && setDone(true));
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (!done) return;
    const t = setInterval(() => setLeft((n) => n - 1), 1000);
    return () => clearInterval(t);
  }, [done]);

  useEffect(() => {
    if (done && left <= 0) navigate('/', { replace: true });
  }, [done, left, navigate]);

  if (!done) return <PageSkeleton />;

  return (
    <Shell bare>
      <Split
        left={
          <Reveal>
            <Eyebrow>Session ended</Eyebrow>
            <h1 className={`mt-3 ${PageTitle}`}>You are signed out</h1>
            <p className="mt-3 max-w-[40ch] text-muted md:text-lg">
              Car in the garage, engine off. Your picks stay saved for next time.
            </p>
            <p className="mt-6 font-mono text-sm uppercase tracking-widest text-muted">
              Back to the grid in{' '}
              <span role="timer" className="tabular-nums text-ink" data-testid="logout-countdown">
                {Math.max(left, 0)}s
              </span>
            </p>
          </Reveal>
        }
        right={
          <Reveal index={1} className="max-w-md">
            <Link to="/" replace className={buttonCls('primary', 'w-full')}>
              <House size={20} weight="regular" aria-hidden="true" />
              Back to home
            </Link>
          </Reveal>
        }
      />
    </Shell>
  );
}
