import { useEffect, useState } from 'preact/hooks';
import { formatElapsed } from '../elapsedFormat';

interface ElapsedTimerProps {
    startedAt: string | null | undefined;
}

export function ElapsedTimer({ startedAt }: ElapsedTimerProps) {
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        if (!startedAt) return;
        setNow(Date.now());
        const id = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(id);
    }, [startedAt]);

    if (!startedAt) return null;
    const startMs = Date.parse(startedAt);
    if (Number.isNaN(startMs)) return null;

    return <span class="step-tab__elapsed">{formatElapsed(now - startMs)}</span>;
}
