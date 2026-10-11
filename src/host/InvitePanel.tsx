import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Copy } from '@phosphor-icons/react';
import Button from '../components/Button';
import Skeleton from '../components/Skeleton';
import { useAuth } from '../lib/auth';
import { INVITE_DAY_OPTIONS, ROLES, inviteRolesFor, roleLabel, type Role } from '../lib/roles';
import { INVITE_STATUS_LABEL, inviteLink, inviteStatus } from '../lib/userAdmin';
import { createInvite, revokeInvite, watchInvites, type Invite } from '../lib/users';
import { fmtLocal } from './settings/time';
import { inputCls } from './settings/ui';


const errMsg = (e: unknown, fallback: string) =>
  (e as { code?: string }).code === 'permission-denied' ? 'The server refused this change for your account.' : fallback;

function LinkQr({ url }: { url: string }) {
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(url, { margin: 1, width: 480, color: { dark: '#111', light: '#fff' } })
      .then((d) => !cancelled && setQr(d))
      .catch(() => !cancelled && setQr(null));
    return () => {
      cancelled = true;
    };
  }, [url]);
  return qr ? (
    <img src={qr} alt="QR code for the invite link" className="size-56 rounded-lg border border-line bg-white p-2" />
  ) : (
    <Skeleton className="size-56 rounded-lg" />
  );
}

export default function InvitePanel() {
  const { access } = useAuth();
  const roles = access ? inviteRolesFor(access) : [];
  const [role, setRole] = useState<Role | ''>('');
  const [days, setDays] = useState<number>(7);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [created, setCreated] = useState<{ url: string; role: Role } | null>(null);
  const [copied, setCopied] = useState<'' | 'yes' | 'manual'>('');
  const [invites, setInvites] = useState<Invite[] | null>(null);
  const [listErr, setListErr] = useState(false);
  const [revoking, setRevoking] = useState('');
  const [revokeErr, setRevokeErr] = useState('');

  useEffect(
    () =>
      watchInvites(
        (i) => {
          setListErr(false);
          setInvites(i);
        },
        () => {
          setListErr(true);
          setInvites([]);
        },
      ),
    [],
  );

  const chosen: Role | '' = role && roles.includes(role) ? role : (roles[0] ?? '');

  const create = async () => {
    if (!chosen) return;
    setErr('');
    setCopied('');
    setBusy(true);
    try {
      const token = await createInvite(chosen, days, note);
      setCreated({ url: inviteLink(window.location.origin, token), role: chosen });
      setNote('');
    } catch (e) {
      setErr(errMsg(e, 'Could not create the link. Check your signal and try again.'));
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.url);
      setCopied('yes');
    } catch {
      setCopied('manual');
    }
  };

  const revoke = async (token: string) => {
    setRevokeErr('');
    setRevoking(token);
    try {
      await revokeInvite(token);
    } catch (e) {
      setRevokeErr(errMsg(e, 'Could not revoke that link. Try again.'));
    } finally {
      setRevoking('');
    }
  };

  if (!roles.length) return null;
  const blurb = ROLES.find((r) => r.id === chosen)?.blurb;
  const now = Date.now();

  return (
    <section aria-label="Invite links" className="border-t border-line py-6">
      <h2 className="text-2xl font-semibold md:text-3xl">Invite links</h2>
      <p className="mt-1 max-w-2xl text-muted">
        Share a secure link or QR code. Whoever opens it, signs in with Google and taps Join gets the role. Anyone with
        the link can use it until it expires or you revoke it, so share it only with the people you mean.
      </p>

      <div className="mt-6 grid max-w-xl gap-4">
        <div>
          <label htmlFor="inv-role" className="text-sm text-muted">
            Role
          </label>
          <select
            id="inv-role"
            className={`${inputCls} mt-1`}
            value={chosen}
            disabled={busy}
            onChange={(e) => setRole(e.target.value as Role)}
          >
            {roles.map((r) => (
              <option key={r} value={r}>
                {roleLabel(r)}
              </option>
            ))}
          </select>
          {blurb && <p className="mt-1 text-sm text-muted">{blurb}</p>}
        </div>
        <div>
          <label htmlFor="inv-days" className="text-sm text-muted">
            Link works for
          </label>
          <select
            id="inv-days"
            className={`${inputCls} mt-1`}
            value={days}
            disabled={busy}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            {INVITE_DAY_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {d} {d === 1 ? 'day' : 'days'}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="inv-note" className="text-sm text-muted">
            Note for yourself (optional)
          </label>
          <input
            id="inv-note"
            className={`${inputCls} mt-1`}
            maxLength={120}
            value={note}
            disabled={busy}
            placeholder="Who or what this link is for"
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <Button disabled={busy || !chosen} onClick={() => void create()} className="w-full sm:w-auto">
          {busy ? 'Creating...' : 'Create invite link'}
        </Button>
        {err && (
          <p role="alert" className="text-sm text-accent-text">
            {err}
          </p>
        )}
      </div>

      {created && (
        <div className="mt-6 grid max-w-xl gap-4 border-l-2 border-accent pl-4" role="group" aria-label="New invite link">
          <p className="font-medium">New {roleLabel(created.role)} link</p>
          <input
            readOnly
            aria-label="Invite link"
            className={`${inputCls} font-mono text-sm`}
            value={created.url}
            onFocus={(e) => e.currentTarget.select()}
          />
          <Button variant="secondary" onClick={() => void copy()} className="w-full sm:w-auto">
            <Copy size={20} weight="regular" aria-hidden="true" /> Copy link
          </Button>
          <p role="status" className="text-sm text-muted">
            {copied === 'yes' && 'Link copied.'}
            {copied === 'manual' && 'Copy is blocked here. Select the link above and copy it by hand.'}
          </p>
          <LinkQr url={created.url} />
        </div>
      )}

      <h3 className="mt-8 text-xl font-semibold">Recent links</h3>
      {invites === null ? (
        <Skeleton className="mt-3 h-16 w-full" />
      ) : listErr ? (
        <p role="alert" className="mt-3 text-accent-text">
          Couldn&rsquo;t load invite links. Try refreshing.
        </p>
      ) : invites.length === 0 ? (
        <p className="mt-3 text-muted">No invite links yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-line border-y border-line">
          {invites.map((i) => {
            const st = inviteStatus(i, now);
            return (
              <li key={i.token} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-3">
                <span className="min-w-0">
                  <span className="text-ink">{roleLabel(i.role)}</span>
                  <span className="ml-2 rounded border border-line px-2 py-0.5 text-xs text-muted">
                    {INVITE_STATUS_LABEL[st]}
                  </span>
                  <span className="mt-0.5 block font-mono text-sm text-muted">
                    Expires {fmtLocal(i.expiresAt.toMillis())} &middot; {i.createdBy}
                  </span>
                  {i.note && <span className="block truncate text-sm text-muted">{i.note}</span>}
                </span>
                {st === 'active' && (
                  <Button
                    variant="secondary"
                    className="min-h-11"
                    disabled={revoking === i.token}
                    onClick={() => void revoke(i.token)}
                    aria-label={`Revoke ${roleLabel(i.role)} link ending ${i.token.slice(-4)}`}
                  >
                    {revoking === i.token ? 'Revoking...' : 'Revoke'}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {revokeErr && (
        <p role="alert" className="mt-3 text-sm text-accent-text">
          {revokeErr}
        </p>
      )}
    </section>
  );
}
