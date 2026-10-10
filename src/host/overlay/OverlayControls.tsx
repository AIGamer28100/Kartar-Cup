import { Link } from 'react-router';
import Button from '../../components/Button';
import { SIZE_ORDER, SIZE_PRESETS, shortJoinUrl } from './overlayModel';
import { useOverlay, type OverlayContextValue } from './OverlayProvider';
import { useOverlayData } from './useOverlayData';
import type { OverlayData } from './LiveOverlay';

/**
 * Host console panel for the live overlay. Internal tool (R20): quiet, dense, no motion. Mirrors
 * PodiumController's section layout. Renders nothing outside the host app's OverlayProvider.
 */
export default function OverlayControls() {
  const overlay = useOverlay();
  if (!overlay) return null;
  return <ConnectedControls overlay={overlay} />;
}

function ConnectedControls({ overlay }: { overlay: OverlayContextValue }) {
  const data = useOverlayData();
  return <OverlayControlsView overlay={overlay} data={data} />;
}

const MODE_TEXT = {
  pip: 'Picture-in-Picture: an always-on-top window that floats over every tab and app.',
  popup:
    'Popup fallback: this browser has no Document Picture-in-Picture (Chrome or Edge 116+ has). Pin the popup on top with your OS.',
} as const;

const seg = 'min-h-9 px-3 text-sm first:rounded-l-md last:rounded-r-md border border-line -ml-px first:ml-0 transition-colors focus-visible:relative focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50';

/** Presentational, so the Mock Lab can show every state without a provider or Firestore. */
export function OverlayControlsView({ overlay, data }: { overlay: OverlayContextValue; data: OverlayData }) {
  const { supported, mode, isOpen, opening, allowed, error, size, setSize, open, close } = overlay;
  const status = isOpen ? `Open · ${mode === 'pip' ? 'Picture-in-Picture' : 'popup'}` : opening ? 'Opening...' : 'Closed';

  return (
    <section aria-label="Live overlay" className="border-t border-line py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-semibold">Live overlay</h2>
        <p className="flex items-center gap-2 font-mono text-sm text-muted" aria-live="polite">
          <span aria-hidden="true" className={`inline-block size-2 rounded-full ${isOpen ? 'bg-accent' : 'bg-line'}`} />
          {status}
        </p>
      </div>
      <p className="mt-2 max-w-[70ch] text-sm text-muted">
        A small panel over the race: join QR, closing countdown, players in, then the top 5. To show it on the big screen, cast your
        whole screen (Chrome menu, Cast, Sources, Cast screen), not just a tab: the overlay is its own window.
      </p>

      <dl className="mt-4 grid max-w-[70ch] grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted">Mode</dt>
        <dd className={supported ? 'text-ink' : 'text-warn'}>{MODE_TEXT[mode]}</dd>
        <dt className="text-muted">Follows</dt>
        <dd className="truncate">
          {data.loading ? <span className="text-muted">Loading...</span> : data.quiz ? `${data.quiz.name} (the live quiz)` : <span className="text-muted">No live quiz right now</span>}
        </dd>
        <dt className="text-muted">Join link</dt>
        <dd className="min-w-0 truncate">
          {data.loading ? (
            <span className="text-muted">Loading...</span>
          ) : data.joinUrl ? (
            <span className="font-mono">{shortJoinUrl(data.joinUrl)}</span>
          ) : data.quiz ? (
            <Link to={data.quizTabHref} className="text-accent-text underline underline-offset-2 hover:text-ink">
              Create a quiz link in the event&apos;s Quiz tab
            </Link>
          ) : (
            <span className="text-muted">None</span>
          )}
        </dd>
      </dl>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <div role="group" aria-label="Overlay size" className="flex">
          {SIZE_ORDER.map((id) => {
            const p = SIZE_PRESETS[id];
            const on = size === id;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={on}
                title={`${p.width} x ${p.height}: ${p.hint}`}
                onClick={() => setSize(id)}
                className={`${seg} ${on ? 'border-ink bg-ink text-base' : 'bg-raised text-muted hover:text-ink'}`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
        {isOpen ? (
          <Button variant="secondary" onClick={close} className="min-h-10 px-4 text-sm">
            Close overlay
          </Button>
        ) : (
          <Button onClick={() => void open()} disabled={!allowed || opening} className="min-h-10 px-4 text-sm">
            {opening ? 'Opening...' : 'Open overlay'}
          </Button>
        )}
        <span className="text-xs text-muted">{SIZE_PRESETS[size].hint}. Drag its corner to resize.</span>
      </div>

      {!allowed && <p className="mt-3 text-sm text-muted">Only a host can open the overlay.</p>}
      {error && (
        <p role="alert" className="mt-3 text-sm text-accent-text">
          {error}
        </p>
      )}
    </section>
  );
}
