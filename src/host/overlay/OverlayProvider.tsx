import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router';
import { useAuth } from '../../lib/auth';
import LiveOverlay from './LiveOverlay';
import {
  DEFAULT_SIZE,
  OVERLAY_PATH,
  POPUP_CHROME,
  POPUP_NAME,
  SIZE_PRESETS,
  isOverlaySize,
  popupFeatures,
  type OverlaySize,
} from './overlayModel';
import { useOverlayData } from './useOverlayData';
import { usePictureInPicture, type DocumentPipApi } from './usePictureInPicture';

/**
 * Host-only live overlay, mounted ONCE at the root of the host app so it survives navigation between
 * host pages (R62).
 *   - 'pip': Document Picture-in-Picture (Chrome/Edge 116+), an always-on-top window React portals into;
 *   - 'popup': fallback for browsers without it, a small window on /host/overlay the host pins with the OS.
 * Leaving the host app (unmounting this provider) closes the PiP window.
 */

export type OverlayMode = 'pip' | 'popup';

export interface OverlayContextValue {
  /** Document Picture-in-Picture is available (else the popup fallback is used). */
  supported: boolean;
  /** The mode in use while open, else the mode `open()` would use. */
  mode: OverlayMode;
  isOpen: boolean;
  opening: boolean;
  /** Only hosts may open it (useAuth().access.isHost). */
  allowed: boolean;
  error: string | null;
  size: OverlaySize;
  setSize: (s: OverlaySize) => void;
  /** Call from a click handler: Chrome requires a user gesture. Resolves to whether it opened. */
  open: () => Promise<boolean>;
  close: () => void;
}

const Ctx = createContext<OverlayContextValue | null>(null);

/** Null outside the provider (e.g. Mock Lab, guest pages): callers render nothing then. */
export const useOverlay = (): OverlayContextValue | null => useContext(Ctx);

const SIZE_KEY = 'kc:overlay:size';
function readSize(): OverlaySize {
  try {
    const v = localStorage.getItem(SIZE_KEY);
    return isOverlaySize(v) ? v : DEFAULT_SIZE;
  } catch {
    return DEFAULT_SIZE;
  }
}

/** The overlay fed by live data. Mounted only while a window is open, so nothing listens otherwise. */
function ConnectedOverlay({ onQuizTab }: { onQuizTab?: (href: string) => void }) {
  const data = useOverlayData();
  return <LiveOverlay {...data} onQuizTab={onQuizTab ? () => onQuizTab(data.quizTabHref) : undefined} />;
}

export function OverlayProvider({ children, pipApi }: { children: ReactNode; pipApi?: DocumentPipApi | null }) {
  const { access } = useAuth();
  const allowed = !!access?.isHost;
  const navigate = useNavigate();
  const pip = usePictureInPicture(pipApi === undefined ? {} : { api: pipApi });
  const [size, setSizeState] = useState<OverlaySize>(readSize);
  const [popupOpen, setPopupOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const popup = useRef<Window | null>(null);

  // A popup has no event when the user closes it: poll.
  useEffect(() => {
    if (!popupOpen) return;
    const id = window.setInterval(() => {
      if (!popup.current || popup.current.closed) {
        popup.current = null;
        setPopupOpen(false);
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [popupOpen]);

  const open = useCallback(async (): Promise<boolean> => {
    setError(null);
    if (!allowed) {
      setError('Only a host can open the live overlay.');
      return false;
    }
    if (pip.supported) return pip.open(SIZE_PRESETS[size]);
    if (popup.current && !popup.current.closed) {
      popup.current.focus();
      return true;
    }
    const w = window.open(`${OVERLAY_PATH}?size=${size}`, POPUP_NAME, popupFeatures(size));
    if (!w) {
      setError('The browser blocked the popup. Allow popups for this site, then try again.');
      return false;
    }
    popup.current = w;
    setPopupOpen(true);
    return true;
  }, [allowed, pip, size]);

  const close = useCallback(() => {
    pip.close();
    try {
      popup.current?.close();
    } catch {
      /* already gone */
    }
    popup.current = null;
    setPopupOpen(false);
  }, [pip]);

  const setSize = useCallback(
    (s: OverlaySize) => {
      setSizeState(s);
      try {
        localStorage.setItem(SIZE_KEY, s);
      } catch {
        /* private mode */
      }
      const p = SIZE_PRESETS[s];
      if (pip.win) pip.resize(p);
      const w = popup.current;
      if (w && !w.closed) {
        try {
          w.resizeTo(p.width + POPUP_CHROME.width, p.height + POPUP_CHROME.height);
        } catch {
          /* browsers may refuse */
        }
      }
    },
    [pip],
  );

  // PiP link clicks bring the main window forward, then navigate there.
  const onQuizTab = useCallback(
    (href: string) => {
      navigate(href);
      window.focus();
    },
    [navigate],
  );

  const pipOpen = !!pip.win;
  const value = useMemo<OverlayContextValue>(
    () => ({
      supported: pip.supported,
      mode: pipOpen ? 'pip' : popupOpen ? 'popup' : pip.supported ? 'pip' : 'popup',
      isOpen: pipOpen || popupOpen,
      opening: pip.opening,
      allowed,
      error: error ?? pip.error,
      size,
      setSize,
      open,
      close,
    }),
    [pip.supported, pip.opening, pip.error, pipOpen, popupOpen, allowed, error, size, setSize, open, close],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      {pip.container && createPortal(<ConnectedOverlay onQuizTab={onQuizTab} />, pip.container)}
    </Ctx.Provider>
  );
}

/** The /host/overlay popup page: only the overlay, full window. */
export function OverlayPage() {
  useEffect(() => {
    const prev = document.title;
    document.title = 'Kartar CUP live overlay';
    return () => {
      document.title = prev;
    };
  }, []);
  return (
    <div className="fixed inset-0 z-50 bg-base">
      <ConnectedOverlay />
    </div>
  );
}
