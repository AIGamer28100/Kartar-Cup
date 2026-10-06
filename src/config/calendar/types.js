export function nextRace(now, races) {
    const today = now.toISOString().slice(0, 10);
    return ([...races]
        .sort((a, b) => a.raceDate.localeCompare(b.raceDate))
        .find((r) => r.status === 'scheduled' && r.raceDate >= today) ?? null);
}
