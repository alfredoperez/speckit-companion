export interface ToastProps {
    id?: string;
}

export function Toast({ id }: ToastProps) {
    return <span class="action-toast" id={id} />;
}

/** Show a toast message by DOM id. */
export function showToast(id: string, message: string, duration = 2000): void {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = message;
    el.classList.add('visible');
    setTimeout(() => el.classList.remove('visible'), duration);
}
