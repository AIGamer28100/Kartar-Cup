import { roleLabel } from './roles';
const NEED = {
    host: { label: 'Host, Admin or Super admin', ok: (a) => a.isHost, grant: 'Host' },
    admin: { label: 'Admin or Super admin', ok: (a) => a.isAdmin, grant: 'Admin' },
    bookings: { label: 'Host, Admin, Super admin or Venue host', ok: (a) => a.canRunBookings, grant: 'Host or Venue host' },
};
const isDenied = (e) => typeof e === 'object' && e !== null && e.code === 'permission-denied';
/** `what` finishes the sentence "...to <what>", e.g. "save a booking event". */
export function permissionHint(e, need, access, what) {
    if (!isDenied(e))
        return e instanceof Error ? e.message : `Could not ${what}. Try again.`;
    const n = NEED[need];
    const mine = access
        ? access.isSuperAdmin
            ? 'Super admin'
            : access.roles.length
                ? access.roles.map(roleLabel).join(', ')
                : 'no staff role'
        : 'unknown';
    if (!access || !n.ok(access)) {
        return `You need the ${n.label} role to ${what}. Your account has: ${mine}. Ask an admin to give you the ${n.grant} role in Host > People.`;
    }
    return (`The database refused to ${what}, even though your account (${mine}) has the right role. ` +
        `Usually the latest security rules are not deployed yet (deploy firestore.rules together with the app, using --project kartar-cup), ` +
        `or the data failed a rules check (an unexpected or oversized field). Needed role: ${n.label}.`);
}
