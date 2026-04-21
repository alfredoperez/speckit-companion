import { useCallback, useEffect, useRef, useState } from 'preact/hooks';

export interface InlineConfirmOptions {
    label?: string;
    window?: number;
}

export interface InlineConfirm {
    label: string | null;
    onClick: () => void;
    armed: boolean;
}

/**
 * Pure state-machine factory for two-click confirmation (R026).
 *
 * Extracted as a plain function so it can be unit-tested without Preact
 * rendering. The `useInlineConfirm` hook below is a thin Preact wrapper.
 *
 * Behavior:
 *   - First call arms the action and emits `options.label` (default
 *     "Confirm?") via the observer for `options.window` ms (default 3000).
 *   - Second call while armed clears the timer and fires `action()` once.
 *   - If the window elapses, the armed state reverts silently.
 *   - `dispose()` clears any pending timer (used on unmount).
 */
export function createInlineConfirm(
    action: () => void,
    options: InlineConfirmOptions,
    notify: (armed: boolean) => void,
    setTimer: (fn: () => void, ms: number) => number | undefined,
    clearTimer: (id: number | undefined) => void,
) {
    const { window: windowMs = 3000 } = options;
    let armed = false;
    let timerId: number | undefined;

    const dispose = () => {
        clearTimer(timerId);
        timerId = undefined;
    };

    const onClick = () => {
        if (armed) {
            dispose();
            armed = false;
            notify(false);
            action();
            return;
        }
        armed = true;
        notify(true);
        timerId = setTimer(() => {
            armed = false;
            timerId = undefined;
            notify(false);
        }, windowMs);
    };

    return { onClick, dispose };
}

export function useInlineConfirm(
    action: () => void,
    options: InlineConfirmOptions = {}
): InlineConfirm {
    const { label = 'Confirm?' } = options;
    const [armed, setArmed] = useState(false);
    const machineRef = useRef<ReturnType<typeof createInlineConfirm> | null>(null);

    if (machineRef.current === null) {
        machineRef.current = createInlineConfirm(
            action,
            options,
            setArmed,
            (fn, ms) => window.setTimeout(fn, ms),
            (id) => {
                if (id !== undefined) window.clearTimeout(id);
            }
        );
    }

    const onClick = useCallback(() => {
        machineRef.current?.onClick();
    }, []);

    useEffect(() => () => machineRef.current?.dispose(), []);

    return {
        label: armed ? label : null,
        onClick,
        armed,
    };
}
