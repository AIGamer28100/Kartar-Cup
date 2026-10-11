import { useState } from 'react';
import type { User } from 'firebase/auth';
import { ArrowRight, Copy } from '@phosphor-icons/react';
import Button, { buttonCls } from '../components/Button';
import Divider from '../components/Divider';
import { isInAppBrowser } from '../lib/inAppBrowser';

/** Display name from the Google account (falls back to the email local part). */
export const accountName = (u: User): string =>
  (u.displayName?.trim() || u.email?.split('@')[0] || 'Driver').slice(0, 60);

const inputCls =
  'min-h-12 w-full rounded-lg border border-line bg-raised px-4 text-[1rem] text-ink placeholder:text-muted focus:border-accent';

const focusCls = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

export function signInError(e: unknown): string {
  const code = (e as { code?: string }).code ?? '';
  if (code === 'auth/popup-blocked')
    return 'Your browser blocked the Google window. Allow pop-ups for this site, then try again.';
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request')
    return 'The Google window was closed before finishing. Try again when you are ready.';
  return 'Google sign-in did not go through. Check your signal and try again.';
}

function InAppPanel() {
  const [copied, setCopied] = useState<'yes' | 'manual' | ''>('');
  const url = window.location.href;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied('yes');
    } catch {
      setCopied('manual');
    }
  };
  return (
    <div className="border-l-2 border-accent pl-4" role="group" aria-labelledby="iab-h">
      <h2 id="iab-h" className="text-xl font-semibold tracking-tight">
        Open in Chrome or Safari to sign in
      </h2>
      <p className="mt-2 text-muted">
        This in-app browser blocks Google sign-in. Open the page in your normal browser, then sign in there.
      </p>
      <ol className="mt-3 list-decimal pl-5 text-sm text-muted">
        <li>Tap the three-dot menu or the share icon at the top or bottom.</li>
        <li>Choose Open in browser, Open in Chrome or Open in Safari.</li>
        <li>Or copy the link below and paste it into your browser.</li>
      </ol>
      <Button variant="secondary" className={`mt-4 w-full ${focusCls}`} onClick={() => void copy()}>
        <Copy size={20} weight="regular" aria-hidden="true" />
        Copy link
      </Button>
      <p role="status" className="mt-2 text-sm text-muted">
        {copied === 'yes' && 'Link copied. Paste it into Chrome or Safari.'}
      </p>
      {copied === 'manual' && (
        <input
          readOnly
          aria-label="Page link"
          className={`${inputCls} mt-2 font-mono text-sm`}
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          ref={(el) => el?.select()}
        />
      )}
    </div>
  );
}

interface CtaProps {
  onGoogle: () => Promise<void>;
}

/** Hero CTA doubling as the Google sign-in (R14: Google is the only way in). Errors and the in-app-browser panel render inline. */
export default function GoogleCta({ onGoogle }: CtaProps) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const inApp = isInAppBrowser();

  const go = async () => {
    setErr('');
    setBusy(true);
    try {
      await onGoogle();
    } catch (e) {
      setErr(signInError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Button id="g-cta" disabled={busy} onClick={() => void go()} className="w-full md:min-h-14">
        {busy ? 'Opening Google...' : 'Get on the grid'}
        <ArrowRight size={20} weight="regular" aria-hidden="true" />
      </Button>
      {err && (
        <p role="alert" className="text-sm text-accent-text">
          {err}{' '}
          <button type="button" onClick={() => void go()} className={`${buttonCls("secondary", "min-h-11 px-4 text-sm")} ${focusCls}`}>
            Retry
          </button>
        </p>
      )}
      {inApp && <Divider />}
      {inApp && <InAppPanel />}
    </div>
  );
}
