/** Karter Cup (PRD s24): pure types and standings maths. No Firebase imports, so it is unit-testable.
 * Scoring is host-configurable (pointsTable), never hard-coded F1 (PRD s7.3). */
export const MAX_POINTS_POSITIONS = 20;
export const MAX_DRIVERS = 100;
/** Editable starting point only; the host sets the real table per season. */
export const DEFAULT_POINTS_TABLE = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
const pts = (n) => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0);
/** Only a published, completed round with a result counts; unpublished data never leaks into public standings. */
export const roundCounts = (r) => r.published && r.status === 'completed' && !!r.result && Array.isArray(r.result.order);
export function compareRows(a, b) {
    if (b.points !== a.points)
        return b.points - a.points;
    if (b.wins !== a.wins)
        return b.wins - a.wins;
    if (b.podiums !== a.podiums)
        return b.podiums - a.podiums;
    const ab = a.bestFinish ?? Infinity;
    const bb = b.bestFinish ?? Infinity;
    if (ab !== bb)
        return ab - bb;
    const byName = a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });
    return byName !== 0 ? byName : a.driverId.localeCompare(b.driverId);
}
export function computeStandings(drivers, rounds, pointsTable, fastestLapBonus = 0) {
    const rows = new Map();
    for (const d of drivers) {
        rows.set(d.id, {
            driverId: d.id,
            name: d.name,
            points: 0,
            wins: 0,
            podiums: 0,
            rounds: 0,
            bestFinish: null,
            ...(d.team ? { team: d.team } : {}),
            ...(typeof d.number === 'number' ? { number: d.number } : {}),
        });
    }
    const bonus = pts(fastestLapBonus);
    let roundsCounted = 0;
    for (const r of [...rounds].filter(roundCounts).sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))) {
        roundsCounted++;
        const res = r.result;
        const dnf = new Set(res.dnf ?? []);
        const seen = new Set();
        let pos = 0;
        for (const id of res.order) {
            if (typeof id !== 'string' || seen.has(id) || dnf.has(id))
                continue;
            seen.add(id);
            pos++; // a removed driver keeps their slot so others' positions do not shift
            const row = rows.get(id);
            if (!row)
                continue;
            row.rounds++;
            row.points += pts(pointsTable[pos - 1]);
            if (pos === 1)
                row.wins++;
            if (pos <= 3)
                row.podiums++;
            row.bestFinish = row.bestFinish === null ? pos : Math.min(row.bestFinish, pos);
        }
        for (const id of dnf) {
            if (seen.has(id))
                continue;
            const row = rows.get(id);
            if (row)
                row.rounds++;
        }
        const fl = res.fastestLap;
        if (bonus > 0 && fl && !dnf.has(fl)) {
            const row = rows.get(fl);
            if (row)
                row.points += bonus;
        }
    }
    const active = new Map(drivers.map((d) => [d.id, d.active]));
    const list = [...rows.values()].filter((r) => active.get(r.driverId) || r.rounds > 0).sort(compareRows);
    const teams = new Map();
    for (const r of list) {
        if (!r.team)
            continue;
        const t = teams.get(r.team) ?? { team: r.team, points: 0, wins: 0, podiums: 0 };
        t.points += r.points;
        t.wins += r.wins;
        t.podiums += r.podiums;
        teams.set(r.team, t);
    }
    const teamList = [...teams.values()].sort((a, b) => b.points - a.points || b.wins - a.wins || a.team.localeCompare(b.team, 'en', { sensitivity: 'base' }));
    return { drivers: list, teams: teamList, roundsCounted };
}
/** Pure validation for the points table the host types in. Returns an error message or ''. */
export function validatePointsTable(t) {
    if (t.length < 1)
        return 'Add at least one position.';
    if (t.length > MAX_POINTS_POSITIONS)
        return `At most ${MAX_POINTS_POSITIONS} positions.`;
    if (t.some((n) => !Number.isInteger(n) || n < 0 || n > 1000))
        return 'Points must be whole numbers from 0 to 1000.';
    return '';
}
/** Parses "25, 18 15" into numbers; non-numeric tokens become NaN so validatePointsTable rejects them. */
export const parsePointsTable = (s) => s.split(/[\s,]+/).filter(Boolean).map((x) => (/^\d+$/.test(x) ? Number(x) : NaN));
/** Round dates are YYYY-MM-DD strings; format without timezone drift. */
export function fmtRoundDate(d) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
    if (!m)
        return d;
    return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
    });
}
/** Latest published season to show publicly: active first, then newest year. */
export function pickSeason(list) {
    if (list.length === 0)
        return null;
    const rank = (s) => (s.status === 'active' ? 0 : 1);
    return [...list].sort((a, b) => rank(a) - rank(b) || b.year - a.year || a.name.localeCompare(b.name))[0];
}
