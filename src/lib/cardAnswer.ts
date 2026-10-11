/** R71: the Play-card quiz answer is one string, "<driverId>:<points>", points an integer 0..999. */
export function formatCardAnswer(driverId: string, points: number): string {
  return `${driverId}:${points}`;
}

export function parseCardAnswer(s: string | undefined): { driverId: string; points: number } | null {
  const m = /^([A-Za-z0-9_-]{1,30}):(\d{1,3})$/.exec(s ?? '');
  return m ? { driverId: m[1], points: Number(m[2]) } : null;
}
