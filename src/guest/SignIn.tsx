import { useState, type FormEvent } from 'react';
import { GoogleLogo } from '@phosphor-icons/react';
import Button from '../components/Button';
import Divider from '../components/Divider';
import { isInAppBrowser } from '../lib/inAppBrowser';
import { Eyebrow, Reveal, Shell } from './parts';

export const PHONE_RE = /^[0-9+ ]{7,16}$/;
export const validName = (n: string) => n.trim().length >= 2;

const inputCls =
  'min-h-12 w-full rounded-lg border border-line bg-raised px-4 text-[1rem] text-ink placeholder:text-muted focus:border-accent';

interface Props {
  name: string;
  phone: string;
  onChange: (p: { name?: string; phone?: string }) => void;
  onGuest: () => Promise<void>;
  onGoogle: () => Promise<void>;
}

export default function SignIn({ name, phone, onChange, onGuest, onGoogle }: Props) {
  const [busy, setBusy] = useState<'guest' | 'google' | null>(null);
  const [nameErr, setNameErr] = useState('');
  const [phoneErr, setPhoneErr] = useState('');
  const [authErr, setAuthErr] = useState('');
  const hideGoogle = isInAppBrowser();

  const check = (needName: boolean): boolean => {
    const ne = needName && !validName(name) ? 'Give race control at least 2 characters.' : '';
    const pe = phone.trim() && !PHONE_RE.test(phone.trim()) ? 'Digits, + and spaces only, 7 to 16 long.' : '';
    setNameErr(ne);
    setPhoneErr(pe);
    return !ne && !pe;
  };

  const run = async (kind: 'guest' | 'google', fn: () => Promise<void>) => {
    setAuthErr('');
    if (!check(kind === 'guest')) return;
    setBusy(kind);
    try {
      await fn();
    } catch {
      setAuthErr(
        kind === 'google'
          ? 'Google sign-in did not go through. Try again, or join with your name.'
          : 'Could not reach race control. Check your signal and try again.',
      );
    } finally {
      setBusy(null);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void run('guest', onGuest);
  };

  return (
    <Shell>
      <Reveal>
        <Eyebrow>Driver briefing</Eyebrow>
        <h1 className="mt-3 text-4xl font-semibold leading-none tracking-tight">Who is on the radio?</h1>
        <p className="mt-3 text-muted">Your name goes on the board. Prizes need a name to read out.</p>
      </Reveal>

      <form onSubmit={submit} noValidate className="mt-8 flex flex-col gap-6">
        <Reveal index={1}>
          <label htmlFor="g-name" className="mb-2 block text-sm font-medium">
            Name
          </label>
          <input
            id="g-name"
            className={inputCls}
            autoComplete="name"
            value={name}
            onChange={(e) => onChange({ name: e.target.value })}
            aria-invalid={!!nameErr}
            aria-describedby={nameErr ? 'g-name-err' : undefined}
            placeholder="Your call sign"
          />
          {nameErr && (
            <p id="g-name-err" role="alert" className="mt-2 text-sm text-accent">
              {nameErr}
            </p>
          )}
        </Reveal>

        <Reveal index={2}>
          <label htmlFor="g-phone" className="mb-2 block text-sm font-medium">
            Phone <span className="font-normal text-muted">(optional)</span>
          </label>
          <input
            id="g-phone"
            className={`${inputCls} font-mono`}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => onChange({ phone: e.target.value })}
            aria-invalid={!!phoneErr}
            aria-describedby={phoneErr ? 'g-phone-err g-phone-hint' : 'g-phone-hint'}
            placeholder="+91 98765 43210"
          />
          {phoneErr && (
            <p id="g-phone-err" role="alert" className="mt-2 text-sm text-accent">
              {phoneErr}
            </p>
          )}
          <p id="g-phone-hint" className="mt-2 text-sm text-muted">
            We will add you to The Karter Cup WhatsApp community
          </p>
        </Reveal>

        {authErr && (
          <p role="alert" className="text-sm text-accent">
            {authErr}
          </p>
        )}

        <Reveal index={3} className="flex flex-col gap-4">
          <Button type="submit" disabled={busy !== null}>
            {busy === 'guest' ? 'Radioing in...' : 'Join with this name'}
          </Button>
          {!hideGoogle && (
            <>
              <Divider />
              <Button
                variant="secondary"
                disabled={busy !== null}
                onClick={() => void run('google', onGoogle)}
              >
                <GoogleLogo size={20} weight="regular" aria-hidden="true" />
                {busy === 'google' ? 'Opening Google...' : 'Continue with Google'}
              </Button>
            </>
          )}
        </Reveal>
      </form>
    </Shell>
  );
}
