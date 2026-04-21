import { useEffect, useRef, useState } from 'preact/hooks';

export interface UndoToastProps {
    message: string;
    countdownMs?: number;
    onElapse: () => void;
    onUndo: () => void;
    /**
     * When false the toast renders nothing — lets callers suppress it
     * while another run is in flight (R030).
     */
    active?: boolean;
}

/**
 * Countdown toast with an Undo button (R024, R025).
 *
 * - Renders with `.action-toast` styling + a visible progress indicator.
 * - Fires `onElapse` exactly once when the timer completes.
 * - Fires `onUndo` (and clears the timer) when the user clicks Undo
 *   or presses Escape.
 */
export function UndoToast({
    message,
    countdownMs = 5000,
    onElapse,
    onUndo,
    active = true,
}: UndoToastProps) {
    const [remaining, setRemaining] = useState(countdownMs);
    const tickRef = useRef<number | undefined>(undefined);
    const firedRef = useRef(false);

    useEffect(() => {
        if (!active) return;
        const started = performance.now();
        const tick = () => {
            const elapsed = performance.now() - started;
            const left = Math.max(0, countdownMs - elapsed);
            setRemaining(left);
            if (left <= 0) {
                if (!firedRef.current) {
                    firedRef.current = true;
                    onElapse();
                }
                return;
            }
            tickRef.current = window.requestAnimationFrame(tick);
        };
        tickRef.current = window.requestAnimationFrame(tick);
        return () => {
            if (tickRef.current !== undefined) {
                window.cancelAnimationFrame(tickRef.current);
                tickRef.current = undefined;
            }
        };
    }, [active, countdownMs, onElapse]);

    useEffect(() => {
        if (!active) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                handleUndo();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active]);

    const handleUndo = () => {
        if (firedRef.current) return;
        firedRef.current = true;
        if (tickRef.current !== undefined) {
            window.cancelAnimationFrame(tickRef.current);
            tickRef.current = undefined;
        }
        onUndo();
    };

    if (!active) return null;

    const percent = Math.round((remaining / countdownMs) * 100);
    const secondsLeft = Math.ceil(remaining / 1000);

    return (
        <div class="action-toast undo-toast visible" role="status" aria-live="polite">
            <span class="undo-toast-message">{message}</span>
            <span class="undo-toast-countdown" aria-hidden="true">{secondsLeft}s</span>
            <button
                type="button"
                class="undo-toast-button"
                onClick={handleUndo}
                autoFocus
            >
                Undo
            </button>
            <div
                class="undo-toast-progress"
                style={`width: ${percent}%`}
                aria-hidden="true"
            />
        </div>
    );
}
