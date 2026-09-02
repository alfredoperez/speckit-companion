/**
 * A menu that belongs to this panel.
 *
 * Two pickers were native `<select>`s — "+ node" on a phase, and "Replace…" on a
 * node. Everything around them is drawn by this panel; a native select is drawn
 * by the operating system, so those two controls arrived in a different visual
 * language, with a blue system highlight and a popup nothing here can style. In
 * a board this dense they read as somebody else's UI dropped into ours.
 *
 * The panel already had the answer: the workflow switcher in the header is a
 * button and a list. This is that, extracted, so both pickers use it.
 *
 * A `<select>` also flattened every option to one line, which is why the add-on
 * marker arrived as "review-gaps — add-on" glued to the name. An option here has
 * a label and a note, and the note gets its own line.
 */

import { useEffect, useRef, useState } from 'preact/hooks';

export interface MenuOption {
    id: string;
    label: string;
    /** A second line — what this option does, or what kind of thing it is. */
    note?: string;
}

interface Props {
    /** What the closed control shows. A word, or a drawn mark. */
    trigger: preact.ComponentChildren;
    /** What a screen reader says when the trigger is a mark rather than a word. */
    label?: string;
    /** A mark that is already an affordance does not need a caret beside it. */
    caret?: boolean;
    /** Which edge the list hangs from, for a trigger near the right of a lane. */
    align?: 'left' | 'right';
    title: string;
    options: MenuOption[];
    onPick: (id: string) => void;
    /** Styling hook, so a phase tool and an inspector action can differ. */
    class?: string;
    /** Shown, and inert, when there is nothing to offer. */
    disabled?: boolean;
    disabledTitle?: string;
    /**
     * Render it already open.
     *
     * For a story and a documentation capture: an open menu is a state worth
     * reviewing and worth a screenshot, and driving it there with a click means
     * the shot depends on a `play` function having run.
     */
    defaultOpen?: boolean;
}

export function Menu({
    trigger, title, options, onPick, disabled, disabledTitle, defaultOpen,
    label, caret = true, align = 'left', ...rest
}: Props) {
    const [open, setOpen] = useState(Boolean(defaultOpen));
    const root = useRef<HTMLDivElement>(null);

    // A menu that stays open after you look away is a menu you have to dismiss.
    useEffect(() => {
        if (!open) { return undefined; }
        const away = (event: Event) => {
            if (!root.current?.contains(event.target as Node)) { setOpen(false); }
        };
        const escape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') { setOpen(false); }
        };
        document.addEventListener('mousedown', away);
        document.addEventListener('keydown', escape);
        return () => {
            document.removeEventListener('mousedown', away);
            document.removeEventListener('keydown', escape);
        };
    }, [open]);

    if (disabled || options.length === 0) {
        return (
            <span class={`pb-menu-trigger pb-menu-trigger--inert ${rest.class ?? ''}`}
                title={disabledTitle ?? title} aria-label={label}>
                {trigger}
            </span>
        );
    }

    return (
        <div class="pb-menu" ref={root}>
            <button class={`pb-menu-trigger ${rest.class ?? ''}`} title={title}
                aria-label={label} aria-expanded={open} aria-haspopup="menu"
                onClick={() => setOpen(!open)}>
                {trigger}
                {caret && (
                    <span class="pb-menu-caret" aria-hidden="true">{open ? '▴' : '▾'}</span>
                )}
            </button>
            {open && (
                <ul class={`pb-menu-list${align === 'right' ? ' pb-menu-list--right' : ''}`}
                    role="menu">
                    {options.map(option => (
                        <li key={option.id} role="none">
                            <button class="pb-menu-option" role="menuitem"
                                onClick={() => { setOpen(false); onPick(option.id); }}>
                                <span class="pb-menu-label">{option.label}</span>
                                {option.note && (
                                    <span class="pb-menu-note">{option.note}</span>
                                )}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
