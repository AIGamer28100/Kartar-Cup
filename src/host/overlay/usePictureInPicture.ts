import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { PIP_FALLBACK, selectStyleCopies, type StyleNodeLike } from './overlayModel';

/**
 * Document Picture-in-Picture (Chrome/Edge 116+): `documentPictureInPicture.requestWindow()` opens a
 * real always-on-top window that holds arbitrary DOM. React renders into it through a portal.
 *
 * The lifecycle lives in a plain controller (createPipController) so it can be tested in node with a
 * fake `documentPictureInPicture` object: headless Chromium cannot open a real PiP window.
 */

/** The slice of the Document PiP API used here (lib.dom does not type it yet). */
export interface DocumentPipApi {
  requestWindow(options?: { width?: number; height?: number }): Promise<Window>;
  /** The currently open PiP window, if any. */
  readonly window?: Window | null;
}

/** The real API on this window, or null (Firefox, Safari, older Chromium, server render). */
export function getDocumentPip(w: unknown = typeof window === 'undefined' ? undefined : window): DocumentPipApi | null {
  const api = (w as { documentPictureInPicture?: DocumentPipApi } | undefined)?.documentPictureInPicture;
  return api && typeof api.requestWindow === 'function' ? api : null;
}

export interface PipSnapshot {
  /** The PiP window while it is open. */
  win: Window | null;
  /** The element inside it that React portals into. */
  container: HTMLElement | null;
  /** Last failure (rejected requestWindow, etc.), cleared by the next open. */
  error: string | null;
  /** requestWindow in flight. */
  opening: boolean;
}

export interface PipController {
  readonly supported: boolean;
  getSnapshot(): PipSnapshot;
  subscribe(listener: () => void): () => void;
  /** Must be called from a user gesture (a click handler): Chrome rejects it otherwise. */
  open(size: { width: number; height: number }): Promise<boolean>;
  close(): void;
  /** Resize the open window (needs a user gesture in Chrome; failures are ignored). */
  resize(size: { width: number; height: number }): void;
}

const CLOSED: PipSnapshot = { win: null, container: null, error: null, opening: false };

/** Copy the page's stylesheets into the PiP document and paint it navy before anything loads. */
export function preparePipDocument(source: Document, target: Document): HTMLElement {
  for (const c of selectStyleCopies(source.head.querySelectorAll('link, style') as unknown as Iterable<StyleNodeLike>)) {
    const el = c.kind === 'link' ? target.createElement('link') : target.createElement('style');
    if (c.kind === 'link') {
      el.setAttribute('rel', 'stylesheet');
      el.setAttribute('href', c.href);
    } else {
      el.textContent = c.css;
    }
    if (c.media) el.setAttribute('media', c.media);
    target.head.appendChild(el);
  }
  const vars = source.defaultView?.getComputedStyle?.(source.documentElement);
  const read = (name: string, fb: string) => vars?.getPropertyValue(name).trim() || fb;
  const root = target.documentElement;
  root.style.background = read('--color-base', PIP_FALLBACK.background);
  root.style.colorScheme = 'dark';
  root.style.height = '100%';
  const body = target.body;
  body.style.margin = '0';
  body.style.height = '100%';
  body.style.overflow = 'hidden';
  body.style.background = read('--color-base', PIP_FALLBACK.background);
  body.style.color = read('--color-ink', PIP_FALLBACK.color);
  body.style.fontFamily = read('--font-sans', PIP_FALLBACK.font);
  target.title = 'Kartar CUP live overlay';
  const container = target.createElement('div');
  container.style.height = '100%';
  container.setAttribute('data-overlay-root', '');
  body.appendChild(container);
  return container;
}

export function createPipController(api: DocumentPipApi | null, source: Document | null): PipController {
  let snap = CLOSED;
  const listeners = new Set<() => void>();
  let detach: (() => void) | null = null;
  const set = (patch: Partial<PipSnapshot>) => {
    snap = { ...snap, ...patch };
    listeners.forEach((l) => l());
  };
  const reset = (error: string | null = null) => {
    detach?.();
    detach = null;
    set({ win: null, container: null, opening: false, error });
  };

  return {
    supported: !!api,
    getSnapshot: () => snap,
    subscribe(l) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    async open(size) {
      if (!api || !source) {
        set({ error: 'Picture-in-Picture is not available in this browser.' });
        return false;
      }
      if (snap.win) return true;
      set({ opening: true, error: null });
      let win: Window;
      try {
        win = await api.requestWindow({ width: size.width, height: size.height });
      } catch (e) {
        reset(`The overlay window did not open: ${e instanceof Error ? e.message : String(e)}`);
        return false;
      }
      try {
        const container = preparePipDocument(source, win.document);
        // The user closing the PiP window is the only way it ends other than close().
        const onHide = () => reset();
        win.addEventListener('pagehide', onHide);
        detach = () => win.removeEventListener('pagehide', onHide);
        set({ win, container, opening: false, error: null });
        return true;
      } catch (e) {
        try {
          win.close();
        } catch {
          /* already gone */
        }
        reset(`The overlay window could not be prepared: ${e instanceof Error ? e.message : String(e)}`);
        return false;
      }
    },
    close() {
      const w = snap.win;
      reset();
      try {
        w?.close();
      } catch {
        /* already gone */
      }
    },
    resize(size) {
      const w = snap.win;
      if (!w) return;
      try {
        w.resizeTo(size.width + (w.outerWidth - w.innerWidth || 0), size.height + (w.outerHeight - w.innerHeight || 0));
      } catch {
        /* needs a user gesture */
      }
    },
  };
}

/** React binding. `api`/`source` are injectable for tests; the PiP window closes when the host unmounts. */
export function usePictureInPicture(opts: { api?: DocumentPipApi | null; source?: Document | null } = {}) {
  const [ctl] = useState(() =>
    createPipController(opts.api === undefined ? getDocumentPip() : opts.api, opts.source === undefined ? (typeof document === 'undefined' ? null : document) : opts.source),
  );
  const snap = useSyncExternalStore(ctl.subscribe, ctl.getSnapshot, ctl.getSnapshot);
  useEffect(() => () => ctl.close(), [ctl]);
  const open = useCallback((size: { width: number; height: number }) => ctl.open(size), [ctl]);
  const close = useCallback(() => ctl.close(), [ctl]);
  const resize = useCallback((size: { width: number; height: number }) => ctl.resize(size), [ctl]);
  return useMemo(() => ({ supported: ctl.supported, ...snap, open, close, resize }), [ctl, snap, open, close, resize]);
}
