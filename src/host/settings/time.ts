const p = (n: number) => String(n).padStart(2, '0');

export function toLocalInput(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Parse a datetime-local value as host-local time. NaN when empty/invalid. */
export function fromLocalInput(v: string): number {
  return v ? new Date(v).getTime() : NaN;
}

function fmt(ms: number, timeZone?: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(ms));
}

export const fmtLocal = (ms: number) => fmt(ms);
export const fmtIst = (ms: number) => fmt(ms, 'Asia/Kolkata');
export const fmtUtc = (ms: number) => fmt(ms, 'UTC');
