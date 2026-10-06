import { useEffect, useState } from 'react';
export function deriveStatus(config, nowMs) {
    if (config.winnerRevealed)
        return 'scored';
    if (config.override === 'closed' || nowMs >= config.closesAt.toMillis())
        return 'closed';
    if (config.override === 'open' || nowMs >= config.opensAt.toMillis())
        return 'open';
    return 'scheduled';
}
export function useEventStatus(config) {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, []);
    return config ? deriveStatus(config, now) : null;
}
