import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import '@fontsource/barlow-condensed/800-italic.css';
import './styles/index.css';
import ErrorBoundary from './components/ErrorBoundary';

// Production only; failures are ignored so the service worker can never block the app or auth.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}

const root = createRoot(document.getElementById('root')!);

/** App, auth and Firebase load lazily so a misconfigured deploy (no VITE_FIREBASE_* env) shows a
 * readable message instead of a blank page: firebase/auth throws at import time without an API key. */
async function boot() {
  const configured = Boolean(import.meta.env.VITE_FIREBASE_API_KEY) || import.meta.env.VITE_USE_EMULATORS === 'true';
  if (!configured) {
    root.render(
      <main className="mx-auto max-w-xl p-8 text-ink">
        <h1 className="text-2xl font-semibold">The Karter Cup is not configured</h1>
        <p className="mt-3 text-muted">
          This build has no Firebase settings (VITE_FIREBASE_API_KEY). Add the VITE_FIREBASE_* variables and rebuild.
        </p>
      </main>,
    );
    return;
  }
  const [{ default: App }, { AuthProvider }] = await Promise.all([import('./App'), import('./lib/auth')]);
  root.render(
    <StrictMode>
      <ErrorBoundary>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </ErrorBoundary>
    </StrictMode>,
  );
}

boot().catch((e: unknown) =>
  root.render(
    <main className="mx-auto max-w-xl p-8 text-ink">
      <h1 className="text-2xl font-semibold">Red flag. The site could not start.</h1>
      <p className="mt-3 text-muted">{e instanceof Error ? e.message : 'Load failed.'}</p>
      <a className="mt-4 inline-block underline" href="/">Reload</a>
    </main>,
  ),
);
