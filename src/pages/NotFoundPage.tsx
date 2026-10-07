import { House } from '@phosphor-icons/react';
import { Link, useLocation } from 'react-router';
import { buttonCls } from '../components/Button';
import { Eyebrow, PageTitle, Reveal, Shell, Split } from '../guest/parts';

export default function NotFoundPage() {
  const { pathname, search } = useLocation();
  return (
    <Shell bare>
      <Split
        left={
          <Reveal>
            <Eyebrow>Error 404</Eyebrow>
            <h1 className={`mt-3 ${PageTitle}`}>Invalid path</h1>
            <p className="mt-3 max-w-[40ch] text-muted md:text-lg">
              You have gone off the track and into the gravel. Nothing lives here. Race control suggests rejoining
              at the pit lane.
            </p>
            <p className="mt-6 max-w-full break-all font-mono text-sm text-muted" data-testid="attempted-path">
              {(pathname + search).slice(0, 200)}
            </p>
          </Reveal>
        }
        right={
          <Reveal index={1} className="max-w-md">
            <Link to="/" className={buttonCls('primary', 'w-full')}>
              <House size={20} weight="regular" aria-hidden="true" />
              Back to home
            </Link>
          </Reveal>
        }
      />
    </Shell>
  );
}
