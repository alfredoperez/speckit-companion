/**
 * The side column, once.
 *
 * Five panes share this slot — a node's instructions, the hook form, the
 * document shape, a new workflow, a new step — and they are mutually exclusive,
 * but each drew its own head. Two hand-maintained copies of the same chrome
 * drifted: one titled at `--text-lg`, the other at its own size, two close
 * buttons, two `where` lines, two sets of rules that only nearly matched.
 *
 * So the shell is a component and the five are its children. What differs
 * between them is the title, the line under it, and the body — which is what
 * the props are.
 */
import { ComponentChildren } from 'preact';

interface Props {
    /** Names the region for a screen reader, where the visible title is longer. */
    label: string;
    title: ComponentChildren;
    /** The line under the title: where this thing lives, in the board's terms. */
    where?: ComponentChildren;
    onClose: () => void;
    /** What the close button says it does, since the five differ. */
    closeLabel?: string;
    /** Laid out by the pane: a form scrolls its fields, the inspector grids. */
    class?: string;
    children: ComponentChildren;
}

function CloseIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor"
            stroke-width="1.4" stroke-linecap="round" aria-hidden="true" focusable="false">
            <path d="M4 4l8 8M12 4l-8 8" />
        </svg>
    );
}

export function SidePanel({
    label, title, where, onClose, closeLabel = 'Close', class: extra, children,
}: Props) {
    return (
        <aside class={`pb-side${extra ? ` ${extra}` : ''}`} aria-label={label}>
            <header class="pb-side-head">
                <h2 class="pb-side-title">{title}</h2>
                <button class="pb-side-close" onClick={onClose} title={closeLabel}
                    aria-label={closeLabel}>
                    <CloseIcon />
                </button>
                {where && <p class="pb-side-where">{where}</p>}
            </header>
            {children}
        </aside>
    );
}
