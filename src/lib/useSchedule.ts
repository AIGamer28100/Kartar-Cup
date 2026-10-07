import { useEffect, useState } from 'react';
import { fetchSchedule, type SessionTime } from './f1api';

export interface ScheduleState {
  /** The season's real session schedule; null if still loading or the API is unreachable. */
  schedule: Map<number, SessionTime[]> | null;
  /** True once the fetch has finished either way, so UI can avoid flashing a fallback time. */
  settled: boolean;
}

export function useSchedule(season: number | null | undefined): ScheduleState {
  const [state, setState] = useState<ScheduleState>({ schedule: null, settled: false });
  useEffect(() => {
    if (!season) return;
    let cancelled = false;
    setState({ schedule: null, settled: false });
    void fetchSchedule(season).then((schedule) => !cancelled && setState({ schedule, settled: true }));
    return () => {
      cancelled = true;
    };
  }, [season]);
  return state;
}
