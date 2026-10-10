/** Firestore rules budget (1000 expressions, see rules.md A4): one write may carry at most this many
 * NEW or CHANGED tiers (a create counts every tier as new). Bigger saves are written in steps. */
export const MAX_TIER_WRITE = 5;

export interface TierStep<T> {
  /** The full `tiers` array to write in this step. */
  tiers: T[];
  /** How many of the changed tiers are stored once this step is written. */
  savedTiers: number;
}

/** Structural equality that ignores undefined-valued keys (Firestore drops them). */
function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  const ra = a as Record<string, unknown>;
  const rb = b as Record<string, unknown>;
  const ka = Object.keys(ra).filter((k) => ra[k] !== undefined);
  const kb = Object.keys(rb).filter((k) => rb[k] !== undefined);
  return ka.length === kb.length && ka.every((k) => same(ra[k], rb[k]));
}

/** Split a tiers save into steps that each add or change at most `max` tiers versus the stored tiers
 * (`stored` null on create = every tier is new). Step i keeps the stored tier at every index not yet
 * reached, so each intermediate state is itself a valid tier list. */
export function planTierChunks<T>(
  stored: T[] | null,
  next: T[],
  max = MAX_TIER_WRITE,
): { steps: TierStep<T>[]; totalChanged: number } {
  const old = stored ?? [];
  const changed: number[] = [];
  next.forEach((t, i) => {
    if (i >= old.length || !same(t, old[i])) changed.push(i);
  });
  if (changed.length <= max) return { steps: [{ tiers: [...next], savedTiers: changed.length }], totalChanged: changed.length };
  const steps: TierStep<T>[] = [];
  for (let from = 0; from < changed.length; from += max) {
    const upto = Math.min(from + max, changed.length);
    const done = new Set(changed.slice(0, upto));
    const lastIdx = changed[upto - 1];
    const len = next.length <= old.length ? next.length : Math.max(old.length, lastIdx + 1);
    const tiers: T[] = [];
    for (let i = 0; i < len; i++) tiers.push(done.has(i) || i >= old.length ? next[i] : old[i]);
    steps.push({ tiers, savedTiers: upto });
  }
  return { steps, totalChanged: changed.length };
}
