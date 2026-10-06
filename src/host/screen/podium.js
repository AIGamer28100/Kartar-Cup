/** Reads the top 3 straight off rankEntries' own output (already tie-break/override-aware) —
 * never reimplements ranking. Fewer than 3 entries just leaves those slots null. */
export function buildPodium(rankedRows) {
    return {
        p1: rankedRows[0] ?? null,
        p2: rankedRows[1] ?? null,
        p3: rankedRows[2] ?? null,
    };
}
export function nextStage(current) {
    return Math.min(3, current + 1);
}
export function prevStage(current) {
    return Math.max(0, current - 1);
}
export function clampStage(n) {
    return Math.max(0, Math.min(3, Math.round(n)));
}
/** Which podium step (if any) a given stage has just made visible; used to decide what should
 * mount its reveal animation vs. render already-settled (and dimmer). */
export function isRevealed(stage, slot) {
    if (slot === 'p3')
        return stage >= 1;
    if (slot === 'p2')
        return stage >= 2;
    return stage >= 3;
}
export const MODE_LABEL = {
    lobby: 'Lobby',
    standings: 'Standings',
    podium: 'Podium',
};
