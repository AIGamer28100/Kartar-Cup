import { useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import Button, { buttonCls } from '../components/Button';
import Skeleton from '../components/Skeleton';
import GoogleCta from '../guest/SignIn';
import { Eyebrow, PageTitle, Reveal, Shell } from '../guest/parts';
import { useAuth } from '../lib/auth';
import { signInGoogle } from '../lib/firebase';
import { ROLES, accessFor, roleLabel } from '../lib/roles';
import { inviteStatus } from '../lib/userAdmin';
import { getInvite, redeemInvite, watchOwnUser, type Invite } from '../lib/users';

type Load = { kind: 'loading' } | { kind: 'ready'; invite: Invite | null } | { kind: 'error'; denied: boolean };

function Panel({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <Reveal>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h1 className={`mt-3 ${PageTitle}`}>{title}</h1>
      <div className="mt-4 max-w-[44ch] text-muted">{children}</div>
    </Reveal>
  );
}

/** Public /join/:token. The link is the secret; the page reveals only the role being offered. */
export default function JoinPage() {
  const { token = '' } = useParams<{ token: string }>();
  const { ready, user } = useAuth();
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [roles, setRoles] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);

  const uid = user?.uid;

  // Invite reads need a Google sign-in (rules), so wait for one before looking it up.
  useEffect(() => {
    if (!uid) {
      setLoad({ kind: 'loading' });
      return;
    }
    let live = true;
    setLoad({ kind: 'loading' });
    getInvite(token)
      .then((invite) => live && setLoad({ kind: 'ready', invite }))
      .catch((e: unknown) => live && setLoad({ kind: 'error', denied: (e as { code?: string }).code === 'permission-denied' }));
    return () => {
      live = false;
    };
  }, [uid, token]);

  useEffect(() => {
    if (!uid) return;
    return watchOwnUser(
      uid,
      (u) => setRoles(u?.roles ?? []),
      () => setRoles([]),
    );
  }, [uid]);

  const join = async (invite: Invite) => {
    if (!uid || !roles) return;
    setErr('');
    setBusy(true);
    try {
      await redeemInvite(uid, invite, roles);
      setDone(true);
    } catch (e) {
      setErr(
        (e as { code?: string }).code === 'permission-denied'
          ? 'This link can no longer be used. It may have expired or been revoked.'
          : 'Could not join. Check your signal and try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  if (!ready) {
    return (
      <Shell bare>
        <Skeleton className="mt-8 h-10 w-64" />
      </Shell>
    );
  }

  if (!user) {
    return (
      <Shell bare>
        <Panel eyebrow="Invitation" title="You have been invited">
          <p>Sign in with Google to see the invite and join. You will stay on this page.</p>
        </Panel>
        <Reveal index={1} className="mt-6 max-w-sm">
          <GoogleCta onGoogle={async () => void (await signInGoogle())} />
        </Reveal>
      </Shell>
    );
  }

  if (load.kind === 'loading' || roles === null) {
    return (
      <Shell bare>
        <Skeleton className="mt-8 h-10 w-64" />
        <Skeleton className="mt-4 h-5 w-80 max-w-full" />
      </Shell>
    );
  }

  if (load.kind === 'error') {
    return (
      <Shell bare>
        <Panel eyebrow="Invitation" title="We could not open this invite">
          <p role="alert">
            {load.denied ? 'Your account is not allowed to open this link.' : 'Something went wrong loading the invite. Refresh to try again.'}
          </p>
        </Panel>
      </Shell>
    );
  }

  const invite = load.invite;
  const status = invite ? inviteStatus(invite, Date.now()) : null;

  if (!invite || status !== 'active') {
    const why = !invite ? 'This link is not valid.' : status === 'expired' ? 'This link has expired.' : 'This link was revoked.';
    return (
      <Shell bare>
        <Panel eyebrow="Invitation" title="This invite does not work">
          <p role="alert">{why} Ask the person who shared it to send you a new one.</p>
          <Link to="/" className={`${buttonCls('secondary')} mt-6 w-full sm:w-auto`}>
            Go to the home page
          </Link>
        </Panel>
      </Shell>
    );
  }

  const label = roleLabel(invite.role);
  const blurb = ROLES.find((r) => r.id === invite.role)?.blurb;
  const alreadyHas = roles.includes(invite.role);
  const staff = accessFor(false, [...roles, invite.role]).isStaff;

  if (done || alreadyHas) {
    return (
      <Shell bare>
        <Panel eyebrow="Invitation" title={done ? `You joined as ${label}` : `You are already ${label}`}>
          <p role="status">{staff ? 'You can now open the host area.' : 'Your profile is ready.'}</p>
          <Link to={staff ? '/host' : '/profile'} className={`${buttonCls('primary')} mt-6 w-full sm:w-auto`}>
            {staff ? 'Open the host area' : 'Go to your profile'}
          </Link>
        </Panel>
      </Shell>
    );
  }

  return (
    <Shell bare>
      <Panel eyebrow="Invitation" title={`Join as ${label}`}>
        <p>
          You are signed in as <span className="text-ink">{user.email}</span>.
        </p>
        {blurb && <p className="mt-2">{blurb}</p>}
        <Button className="mt-6 w-full sm:w-auto" disabled={busy} onClick={() => void join(invite)}>
          {busy ? 'Joining...' : `Join as ${label}`}
        </Button>
        {err && (
          <p role="alert" className="mt-3 text-sm text-accent-text">
            {err}
          </p>
        )}
      </Panel>
    </Shell>
  );
}
