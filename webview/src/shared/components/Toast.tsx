export interface ToastProps {
    id?: string;
}

/**
 * Toast — small status-bar message that fades in then out.
 *
 * Why this stays imperative: a structural audit flagged `showToast` as
 * "imperative DOM mutation; replace with a context-driven queue."
 * Investigation showed exactly one production caller (`index.tsx` shows
 * the action toast on extension messages); the stacking-queue requirement
 * was speculative. The imperative version handles `.visible` / `.hiding`
 * / `animationend` cleanup with care that's non-trivial to match
 * declaratively. Until a second caller needs stacking, the working
 * imperative API stays — documented here so it doesn't keep getting
 * re-flagged.
 */
export function Toast({ id }: ToastProps) {
    return <div class="action-toast" id={id} />;
}

/** Show a toast message by DOM id. */
export function showToast(id: string, message: string, duration = 2000): void {
    const el = document.getElementById(id);
    if (!el) return;

    // Reset any existing animation
    el.classList.remove('visible', 'hiding');
    el.textContent = message;

    // Force reflow to restart animation
    void el.offsetWidth;

    el.classList.add('visible');

    setTimeout(() => {
        el.classList.add('hiding');
        el.addEventListener('animationend', () => {
            el.classList.remove('visible', 'hiding');
            el.textContent = '';
        }, { once: true });
    }, duration);
}
