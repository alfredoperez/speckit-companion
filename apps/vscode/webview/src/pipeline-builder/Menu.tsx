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

import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';

export interface MenuOption {
    id: string;
    label: string;
    /** A second line — what this option does, or what kind of thing it is. */
    note?: string;
    /**
     * Offered, and impossible here. Shown rather than omitted so the note can
     * say why — "one node here, so there is nothing to split off" teaches that
     * a phase can be split at the same moment it explains why this one cannot.
     * An omitted row teaches nothing.
     */
    disabled?: boolean;
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
    /** Hang the list from the viewport on the side with room, for a trigger inside a pane that clips. */
    floating?: boolean;
}

/** How far a floating list keeps from the trigger, and from the panel's edges. */
const GAP = 4;
const EDGE = 8;

/** Below the trigger when the list fits there, else the roomier side, capped so it scrolls. */
export function placeFloating(
    list: HTMLElement, trigger: HTMLElement, align: 'left' | 'right',
): void {
    const width = document.documentElement.clientWidth || window.innerWidth;
    const height = document.documentElement.clientHeight || window.innerHeight;
    const at = trigger.getBoundingClientRect();
    const below = height - at.bottom - GAP - EDGE;
    const above = at.top - GAP - EDGE;
    const down = below >= list.scrollHeight || below >= above;

    list.style.maxWidth = `${width - EDGE * 2}px`;
    list.style.minWidth = `${Math.min(220, width - EDGE * 2)}px`;
    list.style.maxHeight = `${Math.max(down ? below : above, 0)}px`;
    // Measured from wherever `fixed` puts 0,0, since a contained ancestor can move it.
    list.style.left = '0px';
    list.style.top = '0px';
    list.style.right = 'auto';
    list.style.bottom = 'auto';
    const origin = list.getBoundingClientRect();

    const hang = align === 'right' ? at.right - origin.width : at.left;
    const left = Math.max(EDGE, Math.min(hang, width - EDGE - origin.width));
    const top = down ? at.bottom + GAP : at.top - GAP - origin.height;
    list.style.left = `${left - origin.left}px`;
    list.style.top = `${top - origin.top}px`;
    list.dataset.side = down ? 'below' : 'above';
}

export function Menu({
    trigger, title, options, onPick, disabled, disabledTitle, defaultOpen,
    label, caret = true, align = 'left', floating = false, ...rest
}: Props) {
    const [open, setOpen] = useState(Boolean(defaultOpen));
    const root = useRef<HTMLDivElement>(null);
    const list = useRef<HTMLUListElement>(null);
    const button = useRef<HTMLButtonElement>(null);
    // Whether a person opened it. A story that renders one open is a picture of
    // a menu, and a picture should not take the focus off the page.
    const byHand = useRef(false);

    const items = () => Array.from(
        list.current?.querySelectorAll<HTMLButtonElement>('.pb-menu-option') ?? []);

    /** Close, and give the keyboard back where it came from. */
    const shut = () => {
        setOpen(false);
        button.current?.focus();
    };

    // The keyboard lands on the first entry, the way every other menu behaves.
    // Without it opening this from the keyboard left focus on the trigger, with
    // the only way into the list being a Tab through it.
    // Nothing to land on when every row is inert: the fallback drew an accent
    // ring on the first one, which reads as a selection on a list that offers
    // no selection. The keyboard still reaches the rows by Tab.
    useEffect(() => {
        if (!open || !byHand.current) { return; }
        items().find(item => item.getAttribute('aria-disabled') !== 'true')?.focus();
    }, [open]);

    useLayoutEffect(() => {
        if (!open || !floating) { return undefined; }
        const place = () => {
            if (list.current && button.current) {
                placeFloating(list.current, button.current, align);
            }
        };
        place();
        window.addEventListener('resize', place);
        document.addEventListener('scroll', place, true);
        return () => {
            window.removeEventListener('resize', place);
            document.removeEventListener('scroll', place, true);
        };
    }, [open, floating, align]);

    // A menu that stays open after you look away is a menu you have to dismiss.
    useEffect(() => {
        if (!open) { return undefined; }
        const away = (event: Event) => {
            if (!root.current?.contains(event.target as Node)) { setOpen(false); }
        };
        const escape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') { shut(); }
        };
        document.addEventListener('mousedown', away);
        document.addEventListener('keydown', escape);
        return () => {
            document.removeEventListener('mousedown', away);
            document.removeEventListener('keydown', escape);
        };
    }, [open]);

    /**
     * Arrows walk the list, Home and End jump to its ends.
     *
     * A Map rather than an object literal: an object's prototype answers to
     * `toString` and `constructor`, so a key named either would look up a
     * truthy function and be called as an index.
     */
    const steer = (event: KeyboardEvent) => {
        const entries = items();
        if (entries.length === 0) { return; }
        const at = entries.indexOf(document.activeElement as HTMLButtonElement);
        const to = new Map<string, number>([
            ['ArrowDown', (at + 1) % entries.length],
            ['ArrowUp', (at <= 0 ? entries.length : at) - 1],
            ['Home', 0],
            ['End', entries.length - 1],
        ]).get(event.key);
        if (to === undefined) { return; }
        event.preventDefault();
        entries[to].focus();
    };

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
            {/* `type="button"`, here and on every option: a button inside a
                form submits it by default, and this menu is used inside the
                hook form. Picking "after" from Runs was attaching the hook. */}
            <button type="button" class={`pb-menu-trigger ${rest.class ?? ''}`}
                title={title} ref={button}
                aria-label={label} aria-expanded={open} aria-haspopup="menu"
                onClick={() => { byHand.current = true; setOpen(!open); }}
                onKeyDown={(event: KeyboardEvent) => {
                    if (event.key !== 'ArrowDown' || open) { return; }
                    event.preventDefault();
                    byHand.current = true;
                    setOpen(true);
                }}>
                {trigger}
                {caret && (
                    <span class="pb-menu-caret" aria-hidden="true">{open ? '▴' : '▾'}</span>
                )}
            </button>
            {open && (
                <ul class={`pb-menu-list${align === 'right' ? ' pb-menu-list--right' : ''}${
                    floating ? ' pb-menu-list--floating' : ''}`}
                    role="menu" aria-label={title} ref={list} onKeyDown={steer}>
                    {options.map(option => (
                        <li key={option.id} role="none">
                            {/* `aria-disabled` rather than the native attribute,
                                which would take the row out of the focus order
                                and take its note with it. */}
                            <button type="button" role="menuitem"
                                class={`pb-menu-option${
                                    option.disabled ? ' pb-menu-option--inert' : ''}`}
                                aria-disabled={option.disabled ? 'true' : undefined}
                                onClick={() => {
                                    if (option.disabled) { return; }
                                    shut();
                                    onPick(option.id);
                                }}>
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
