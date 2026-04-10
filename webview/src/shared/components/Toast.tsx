export interface ToastProps {
    id?: string;
}

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
