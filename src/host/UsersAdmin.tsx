import { useEffect, useMemo, useState } from 'react';
import { Check } from '@phosphor-icons/react';
import Button from '../components/Button';
import { RowsSkeleton } from '../components/Skeleton';
import { useAuth } from '../lib/auth';
import { ROLES, grantableRoles, roleLabel, toggleRole, type Role } from '../lib/roles';
import { filterUsers, removesOwnLastAdmin } from '../lib/userAdmin';
import { setUserRoles, watchAllUsers, type UserRecord } from '../lib/users';
import InvitePanel from './InvitePanel';
import { fmtLocal } from './settings/time';

const inputCls =
  'min-h-12 w-full rounded-lg border border-line bg-raised px-4 text-[1rem] text-ink placeholder:text-muted focus:border-accent';

const chipCls =
  'inline-flex min-h-11 items-center gap-1.5 rounded-lg border px-3 text-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50';

function Avatar({ u }: { u: UserRecord }) {
  const [broken, setBroken] = useState(false);
  if (u.photoURL && !broken)
    return (
      <img
        src={u.photoURL}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
        className="size-10 shrink-0 rounded-full border border-line object-cover"
      />
    );
  return (
    <span
      aria-hidden="true"
      className="flex size-10 shrink-0 items-center justify-center rounded-full border border-line bg-raised font-mono text-sm text-muted"
    >
      {(u.name || u.email).slice(0, 1).toUpperCase()}
    </span>
  );
}

interface Pending {
  role: Role;
  on: boolean;
}

function UserRow({ u, isSelf }: { u: UserRecord; isSelf: boolean }) {
  const { access } = useAuth();
  const grantable = access ? grantableRoles(access) : [];
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [confirm, setConfirm] = useState<Pending | null>(null);

  // Own record is read-only: the rules refuse self-edits, which also keeps the last admin in place.
  const readOnly = isSelf;

  const apply = async (p: Pending) => {
    if (!access) return;
    const next = toggleRole(u.roles, p.role, p.on);
    if (removesOwnLastAdmin({ isSelf, isSuperAdmin: access.isSuperAdmin, before: u.roles, after: next })) {
      setErr('You cannot remove your own admin role. Ask another admin.');
      return;
    }
    setErr('');
    setConfirm(null);
    setBusy(true);
    try {
      await setUserRoles(u, next);
    } catch (e) {
      setErr(
        (e as { code?: string }).code === 'permission-denied'
          ? 'The server refused this change for your account.'
          : 'Could not save the change. Check your signal and try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  const onChip = (role: Role) => {
    const on = !u.roles.includes(role);
    if (on) void apply({ role, on });
    else setConfirm({ role, on });
  };

  return (
    <li className="py-4">
      <div className="flex items-start gap-3">
        <Avatar u={u} />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2">
            <span className="truncate font-medium text-ink">{u.name || 'No name'}</span>
            {isSelf && (
              <span className="rounded border border-line px-2 py-0.5 text-xs text-muted">
                You{access?.isSuperAdmin ? ' (Super admin)' : ''}
              </span>
            )}
          </p>
          <p className="truncate text-sm text-muted">{u.email}</p>
          {u.lastSeenAt && (
            <p className="font-mono text-xs text-muted">Last seen {fmtLocal(u.lastSeenAt.toMillis())}</p>
          )}
        </div>
      </div>

      <ul className="mt-3 flex flex-wrap gap-2" aria-label={`Roles for ${u.name || u.email}`}>
        {ROLES.map((r) => {
          const has = u.roles.includes(r.id);
          const canEdit = !readOnly && grantable.includes(r.id);
          if (!canEdit && !has) return null;
          return (
            <li key={r.id}>
              <button
                type="button"
                aria-pressed={has}
                disabled={busy || !canEdit}
                title={r.blurb}
                onClick={() => onChip(r.id)}
                className={`${chipCls} ${has ? 'border-accent text-ink' : 'border-line text-muted hover:text-ink'}`}
              >
                {has && <Check size={16} weight="bold" aria-hidden="true" />}
                {r.label}
                {has && <span className="sr-only"> (on)</span>}
              </button>
            </li>
          );
        })}
        {!u.roles.length && readOnly && <li className="text-sm text-muted">No roles</li>}
      </ul>
      {readOnly && access?.isSuperAdmin && (
        <p className="mt-2 text-sm text-muted">Super admin is set in the Firebase console and cannot be edited here.</p>
      )}

      {confirm && (
        <div role="alertdialog" aria-label="Confirm removing role" className="mt-3 grid gap-3 border-l-2 border-accent pl-4">
          <p>
            Remove {roleLabel(confirm.role)} from {u.name || u.email}?
          </p>
          <div className="flex gap-2">
            <Button className="min-h-11" disabled={busy} onClick={() => void apply(confirm)}>
              Remove role
            </Button>
            <Button variant="secondary" className="min-h-11" onClick={() => setConfirm(null)}>
              Keep it
            </Button>
          </div>
        </div>
      )}
      {busy && (
        <p role="status" className="mt-2 text-sm text-muted">
          Saving...
        </p>
      )}
      {err && (
        <p role="alert" className="mt-2 text-sm text-accent">
          {err}
        </p>
      )}
    </li>
  );
}

function UserList() {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserRecord[] | null>(null);
  const [error, setError] = useState<'' | 'denied' | 'failed'>('');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<Role | 'none' | ''>('');

  useEffect(
    () =>
      watchAllUsers(
        (u) => {
          setError('');
          setUsers(u);
        },
        (e) => {
          setError((e as { code?: string }).code === 'permission-denied' ? 'denied' : 'failed');
          setUsers([]);
        },
      ),
    [],
  );

  const shown = useMemo(() => (users ? filterUsers(users, search, role) : []), [users, search, role]);

  return (
    <section aria-label="People" className="py-6">
      <h2 className="text-2xl font-semibold md:text-3xl">People</h2>
      <p className="mt-1 max-w-2xl text-muted">
        Everyone who has signed in. Turn roles on or off for each person. Only a super admin can make someone an admin.
      </p>
      <div className="mt-6 grid max-w-2xl gap-3 sm:grid-cols-[1fr_14rem]">
        <div>
          <label htmlFor="u-search" className="text-sm text-muted">
            Search name or email
          </label>
          <input
            id="u-search"
            type="search"
            className={`${inputCls} mt-1`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="u-role" className="text-sm text-muted">
            Role
          </label>
          <select
            id="u-role"
            className={`${inputCls} mt-1`}
            value={role}
            onChange={(e) => setRole(e.target.value as Role | 'none' | '')}
          >
            <option value="">Everyone</option>
            <option value="none">No role</option>
            {ROLES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      {users === null ? (
        <RowsSkeleton />
      ) : error === 'denied' ? (
        <p role="alert" className="mt-6 text-accent">
          Your account is not allowed to list people.
        </p>
      ) : error ? (
        <p role="alert" className="mt-6 text-accent">
          Couldn&rsquo;t load people. Try refreshing.
        </p>
      ) : shown.length === 0 ? (
        <p className="mt-6 text-muted">{users.length ? 'No one matches that search.' : 'No one has signed in yet.'}</p>
      ) : (
        <>
          <p role="status" className="mt-4 font-mono text-sm text-muted">
            {shown.length} of {users.length}
          </p>
          <ul className="mt-2 divide-y divide-line border-y border-line">
            {shown.map((u) => (
              <UserRow key={u.uid} u={u} isSelf={u.uid === user?.uid} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

/** Host-area page: admins manage people and roles; hosts get the invite panel only (the rules
 * let any host mint community links but only admins list everyone). */
export default function UsersAdmin() {
  const { access } = useAuth();
  return (
    <>
      {access?.isAdmin ? (
        <UserList />
      ) : (
        <section aria-label="People" className="py-6">
          <h2 className="text-2xl font-semibold md:text-3xl">People</h2>
          <p className="mt-1 text-muted">Only admins can see the full list of people. You can still invite people below.</p>
        </section>
      )}
      <InvitePanel />
    </>
  );
}
