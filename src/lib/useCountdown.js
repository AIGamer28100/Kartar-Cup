import { useEffect, useState } from 'react';
export function computeCountdown(targetMs, nowMs) {
    const totalMs = Math.max(0, targetMs - nowMs);
    const s = Math.floor(totalMs / 1000);
    return {
        days: Math.floor(s / 86400),
        hours: Math.floor((s % 86400) / 3600),
        minutes: Math.floor((s % 3600) / 60),
        seconds: s % 60,
        totalMs,
        done: totalMs === 0,
    };
}
export function useCountdown(target) {
    const targetMs = target == null ? NaN : new Date(target).getTime();
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        if (Number.isNaN(targetMs))
            return;
        setNow(Date.now());
        const id = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(id);
    }, [targetMs]);
    return computeCountdown(Number.isNaN(targetMs) ? 0 : targetMs, now);
}
