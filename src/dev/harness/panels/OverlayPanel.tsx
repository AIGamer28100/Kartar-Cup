import { useState } from 'react';
import { createPortal } from 'react-dom';
import LiveOverlay, { type OverlayData } from '../../../host/overlay/LiveOverlay';
import { OverlayControlsView } from '../../../host/overlay/OverlayControls';
import type { OverlayContextValue } from '../../../host/overlay/OverlayProvider';
import { SIZE_PRESETS, type OverlaySize } from '../../../host/overlay/overlayModel';
import { usePictureInPicture } from '../../../host/overlay/usePictureInPicture';
import { mockEventConfig, ts } from '../../fixtures';
import type { PanelProps } from '../MockLab';
import { Case, Grid, LabButton, Pick } from '../parts';

/* The host's live overlay (Document PiP / popup) with fixture data, at both size presets. */

const MIN = 60_000;
const JOIN = 'https://kartar-cup.web.app/play/Ab3dE5fG7hJ9kL2mN4pQ6rS8';

type StateId = 'open' | 'scheduled' | 'closed' | 'no-link' | 'long' | 'no-quiz' | 'loading' | 'error';
const STATES: { id: StateId; label: string; note: string }[] = [
  { id: 'open', label: 'Open', note: 'Quiz open, closes in under 15 minutes, 12 players in.' },
  { id: 'scheduled', label: 'Scheduled', note: 'Before opening: counts down to the open time.' },
  { id: 'closed', label: 'Closed', note: 'Quiz window over: the timer says so under the QR.' },
  { id: 'no-link', label: 'No link', note: 'No unrevoked play link: tells the host where to create one.' },
  { id: 'long', label: 'Long text', note: 'Very long quiz name, 4-digit count, a 2-day countdown.' },
  { id: 'no-quiz', label: 'No live quiz', note: 'Nothing is set live.' },
  { id: 'loading', label: 'Loading', note: 'Feeds still connecting: static placeholders, only the dot pulses.' },
  { id: 'error', label: 'Error', note: 'A feed failed (e.g. permission-denied).' },
];

function data(id: StateId, now: number): OverlayData {
  const base: OverlayData = {
    loading: false,
    error: null,
    quiz: mockEventConfig({ opensAt: ts(now - 60 * MIN), closesAt: ts(now + 14 * MIN + 32_000) }),
    joinUrl: JOIN,
    quizTabHref: '/host/bookings/mock-event/quiz/details',
  };
  switch (id) {
    case 'scheduled':
      return { ...base, quiz: mockEventConfig({ opensAt: ts(now + 42 * MIN), closesAt: ts(now + 3 * 60 * MIN) }) };
    case 'closed':
      return { ...base, quiz: mockEventConfig({ opensAt: ts(now - 3 * 60 * MIN), closesAt: ts(now - 60 * MIN) }) };
    case 'no-link':
      return { ...base, joinUrl: null };
    case 'long':
      return {
        ...base,
       
        quiz: mockEventConfig({ name: 'Formula 1 Qatar Airways Grand Prix de Sao Paulo Watch Party Special', opensAt: ts(now - MIN), closesAt: ts(now + 2 * 24 * 60 * MIN + 4 * 60 * MIN) }),
      };
    case 'no-quiz':
      return { ...base, quiz: null, joinUrl: null };
    case 'loading':
      return { ...base, loading: true };
    case 'error':
      return { ...base, error: 'Missing or insufficient permissions' };
    default:
      return base;
  }
}

function Sized({ size, children }: { size: OverlaySize; children: React.ReactNode }) {
  const p = SIZE_PRESETS[size];
  return (
    <div>
      <p className="mb-1 font-mono text-[0.65rem] text-muted">
        {p.label} {p.width}x{p.height}
      </p>
      <div data-overlay-preview={size} style={{ width: p.width, height: p.height }} className="overflow-hidden rounded-md border border-ink">
        {children}
      </div>
    </div>
  );
}

const noop = () => {};
const ctx = (over: Partial<OverlayContextValue>): OverlayContextValue => ({
  supported: true,
  mode: 'pip',
  isOpen: false,
  opening: false,
  allowed: true,
  error: null,
  size: 'compact',
  setSize: noop,
  open: async () => false,
  close: noop,
  ...over,
});

const CONTROL_CASES: { id: string; label: string; value: OverlayContextValue }[] = [
  { id: 'pip-closed', label: 'PiP, closed', value: ctx({}) },
  { id: 'pip-open', label: 'PiP, open (wide)', value: ctx({ isOpen: true, size: 'wide' }) },
  { id: 'opening', label: 'Opening', value: ctx({ opening: true }) },
  { id: 'popup', label: 'Popup fallback', value: ctx({ supported: false, mode: 'popup' }) },
  { id: 'popup-open', label: 'Popup open', value: ctx({ supported: false, mode: 'popup', isOpen: true }) },
  { id: 'denied', label: 'Not a host', value: ctx({ allowed: false }) },
  { id: 'error', label: 'Rejected', value: ctx({ error: 'The overlay window did not open: Document PiP requires user activation' }) },
];

export default function OverlayPanel({ nowMs }: PanelProps) {
  const [state, setState] = useState<StateId>('open');
  const [ctl, setCtl] = useState(CONTROL_CASES[0].id);
  const pip = usePictureInPicture();
  const d = data(state, nowMs);
  const note = STATES.find((s) => s.id === state)?.note;

  return (
    <Grid>
      <Case title="Live overlay" note={`${note} Fixed clock = the lab clock. Boxes are the exact preset sizes.`} wide>
        <Pick label="Overlay state" value={state} options={STATES} onChange={setState} />
        <div className="mt-4 flex flex-wrap items-start gap-6">
          <Sized size="compact">
            <LiveOverlay {...d} nowMs={nowMs} />
          </Sized>
          <Sized size="wide">
            <LiveOverlay {...d} nowMs={nowMs} />
          </Sized>
        </div>
      </Case>

      <Case title="Host console controls" note="OverlayControlsView with a stubbed context: every control state." wide>
        <Pick label="Control state" value={ctl} options={CONTROL_CASES} onChange={setCtl} />
        <div className="mt-2">
          <OverlayControlsView overlay={CONTROL_CASES.find((c) => c.id === ctl)!.value} data={data(ctl === 'error' ? 'no-link' : 'open', nowMs)} />
        </div>
      </Case>

      <Case
        title="Real Picture-in-Picture"
        note={
          pip.supported
            ? 'Opens a real Document PiP window with the selected fixture state (Chrome/Edge 116+). Headless browsers cannot show it.'
            : 'This browser has no Document Picture-in-Picture: the host app falls back to the /host/overlay popup.'
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <LabButton onClick={() => void pip.open(SIZE_PRESETS.compact)} pressed={!!pip.win}>
            Open compact
          </LabButton>
          <LabButton onClick={() => void pip.open(SIZE_PRESETS.wide)}>Open wide</LabButton>
          <LabButton onClick={pip.close}>Close</LabButton>
          <span className="font-mono text-[0.65rem] text-muted">{pip.win ? 'open' : pip.opening ? 'opening' : 'closed'}</span>
        </div>
        {pip.error && <p className="mt-2 text-xs text-accent-text">{pip.error}</p>}
        {pip.container && createPortal(<LiveOverlay {...d} />, pip.container)}
      </Case>
    </Grid>
  );
}
