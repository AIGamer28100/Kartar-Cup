import { useEffect, useState } from 'react';

export const LOAD_TIMEOUT_MS = 12_000;

/** True once `active` has stayed true for `ms`, so a skeleton never spins forever. */
export function useTimedOut(active: boolean, ms = LOAD_TIMEOUT_MS): boolean {
  const [out, setOut] = useState(false);
  useEffect(() => {
    if (!active) {
      setOut(false);
      return;
    }
    const t = setTimeout(() => setOut(true), ms);
    return () => clearTimeout(t);
  }, [active, ms]);
  return out;
}
