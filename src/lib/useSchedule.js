import { useEffect, useState } from 'react';
import { fetchSchedule } from './f1api';
export function useSchedule(season) {
    const [state, setState] = useState({ schedule: null, settled: false });
    useEffect(() => {
        if (!season)
            return;
        let cancelled = false;
        setState({ schedule: null, settled: false });
        void fetchSchedule(season).then((schedule) => !cancelled && setState({ schedule, settled: true }));
        return () => {
            cancelled = true;
        };
    }, [season]);
    return state;
}
