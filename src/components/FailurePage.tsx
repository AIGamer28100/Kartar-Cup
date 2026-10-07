import { ArrowClockwise, House } from '@phosphor-icons/react';
import Button, { buttonCls } from './Button';
import { Eyebrow, PageTitle, Reveal, Shell, Split } from '../guest/parts';

/**
 * Reusable failure screen. Router-free on purpose (plain anchor + reload) so the top-level
 * ErrorBoundary can render it even when the router itself is what broke.
 */
export default function FailurePage({ error, onRetry }: { error?: unknown; onRetry?: () => void }) {
  const summary = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  return (
    <Shell bare>
      <Split
        left={
          <Reveal>
            <Eyebrow>Red flag</Eyebrow>
            <h1 className={`mt-3 ${PageTitle}`} role="alert">
              Red flag. Something broke.
            </h1>
            <p className="mt-3 max-w-[40ch] text-muted md:text-lg">
              Race control lost the feed. Nothing you did, probably. Give the marshals a second and try again.
            </p>
            {summary && (
              <p className="mt-6 max-w-[48ch] break-words border-l-2 border-accent pl-4 font-mono text-sm text-muted">
                {summary.slice(0, 240)}
              </p>
            )}
          </Reveal>
        }
        right={
          <Reveal index={1} className="flex max-w-md flex-col gap-3">
            <Button onClick={onRetry ?? (() => window.location.reload())}>
              <ArrowClockwise size={20} weight="regular" aria-hidden="true" />
              Try again
            </Button>
            <a href="/" className={buttonCls('secondary')}>
              <House size={20} weight="regular" aria-hidden="true" />
              Back to home
            </a>
          </Reveal>
        }
      />
    </Shell>
  );
}
