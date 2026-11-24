// One registry hook's details beside its row, or a sheet when narrow: what it runs, who owns it, and what can be done to it here.
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { StockHookRow } from '../../../src/protocol/pipeline';
import { HookSwitch, PlugIcon, hookKey, hookTitle } from './stockParts';
import { HookIcon } from './HookIcon';
import { useModal } from './useModal';

interface Props {
    hook: StockHookRow;
    /** The step's command, in this project's spelling, which the hook runs around. */
    command: string;
    narrow?: boolean;
    /** Render in the flow, for a story, rather than beside its row. */
    inline?: boolean;
    onClose: () => void;
    onToggle: () => void;
    onEdit: () => void;
    onRemove: () => void;
    /** Open the registry the hook lives in, when the project has one. */
    onOpenRegistry?: () => void;
}

const WIDTH = 372;
const GAP = 12;
const EDGE = 8;

function Facts({ hook, command }: { hook: StockHookRow; command: string }) {
    return (
        <dl class="pb-pop-facts pb-shp-facts">
            <dt>Runs</dt>
            <dd>
                {hook.when === 'before' ? 'Before ' : 'After '}
                <span class="pb-pop-mono">{command ? `/${command}` : hook.step}</span>
            </dd>
            <dt>Calls</dt>
            <dd class="pb-pop-mono">{hook.command || 'Names no command'}</dd>
            <dt>Asks</dt>
            <dd>{hook.optional ? 'Optional: the run asks first.' : 'Required: it runs every time.'}</dd>
            {hook.optional && hook.prompt && (
                <>
                    <dt>Its note</dt>
                    <dd>{`"${hook.prompt}"`}</dd>
                </>
            )}
            {hook.conditional && (
                <>
                    <dt>Only if</dt>
                    <dd>A condition the run checks, so it may not run.</dd>
                </>
            )}
        </dl>
    );
}

/** The wide popover: floats beside the row, Escape or a click away closes it, focus goes back. */
function useBeside(box: { current: HTMLDivElement | null }, hook: StockHookRow, active: boolean, onClose: () => void) {
    const [place, setPlace] = useState<{ top: number; left: number } | null>(null);
    const close = useRef(onClose);
    close.current = onClose;

    useLayoutEffect(() => {
        if (!active) { return undefined; }
        const opener = document.activeElement as HTMLElement | null;
        box.current?.focus();
        const row = () => Array.from(document.querySelectorAll<HTMLElement>('[data-stock-hook]'))
            .find(el => el.dataset.stockHook === hookKey(hook)) ?? null;
        const position = () => {
            const at = row()?.getBoundingClientRect();
            const el = box.current;
            if (!at || !el) { return; }
            const vw = document.documentElement.clientWidth || window.innerWidth;
            const vh = document.documentElement.clientHeight || window.innerHeight;
            const width = Math.min(WIDTH, vw - EDGE * 2);
            const right = at.right + GAP + width <= vw - EDGE;
            const left = right ? at.right + GAP : Math.max(EDGE, at.left - GAP - width);
            const top = Math.min(Math.max(at.top, EDGE), Math.max(EDGE, vh - el.offsetHeight - EDGE));
            setPlace({ top, left });
        };
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') { event.preventDefault(); close.current(); }
        };
        const away = (event: MouseEvent) => {
            const target = event.target as Element | null;
            if (!target || box.current?.contains(target) || row()?.contains(target)) { return; }
            close.current();
        };
        position();
        window.addEventListener('resize', position);
        document.addEventListener('scroll', position, true);
        document.addEventListener('keydown', onKey);
        document.addEventListener('mousedown', away);
        return () => {
            window.removeEventListener('resize', position);
            document.removeEventListener('scroll', position, true);
            document.removeEventListener('keydown', onKey);
            document.removeEventListener('mousedown', away);
            const now = document.activeElement;
            const lost = !now || now === document.body || Boolean(box.current?.contains(now));
            if (lost && opener?.isConnected) { opener.focus(); }
        };
    }, [active, hookKey(hook)]);
    return place;
}

function Sheet({ box, onClose }: { box: { current: HTMLDivElement | null }; onClose: () => void }) {
    useModal(box, onClose);
    return null;
}

export function StockHookPopover(props: Props) {
    const { hook, narrow, inline } = props;
    const box = useRef<HTMLDivElement>(null);
    const place = useBeside(box, hook, !narrow && !inline, props.onClose);
    const own = Boolean(hook.own);
    const name = hookTitle(hook);
    const titleId = `pb-shp-${hookKey(hook)}`.replace(/[^\w-]/g, '-');

    const body = (
        <div ref={box}
            class={[
                'pb-popover', 'pb-shp',
                narrow ? 'pb-popover--sheet' : '',
                !narrow && !inline ? 'pb-popover--floating' : '',
            ].filter(Boolean).join(' ')}
            role="dialog" aria-modal={narrow ? 'true' : undefined} aria-labelledby={titleId}
            tabIndex={-1}
            style={place ? `top: ${place.top}px; left: ${place.left}px` : undefined}>
            {narrow && <span class="pb-sheet-grip" aria-hidden="true" />}
            <header class="pb-pop-head">
                <span class={`pb-shp-mark${own ? ' pb-shp-mark--yours' : ''}`}>
                    {own ? <HookIcon type="skill" /> : <PlugIcon />}
                </span>
                <h2 class="pb-pop-title" id={titleId}>{name}</h2>
                <span class={`pb-pop-source${own ? ' pb-pop-source--yours' : ''}`}>
                    {own ? 'Yours' : `from ${hook.extension}`}
                </span>
                <button type="button" class="pb-pop-close" aria-label="Close" title="Close"
                    onClick={props.onClose}>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor"
                        stroke-width="1.4" stroke-linecap="round" aria-hidden="true" focusable="false">
                        <path d="M4 4l8 8M12 4l-8 8" />
                    </svg>
                </button>
            </header>
            <Facts hook={hook} command={props.command} />
            {!own && (
                <p class="pb-pop-empty">
                    {`${hook.extension} writes this entry again when it is reinstalled, so only its switch is changed here.`}
                </p>
            )}
            <footer class="pb-pop-actions">
                <HookSwitch hook={hook} onToggle={props.onToggle} label />
                {own ? (
                    <>
                        <button type="button" class="pb-pop-button pb-shp-push" onClick={props.onEdit}>Edit</button>
                        <button type="button" class="pb-pop-remove" onClick={props.onRemove}>Remove</button>
                    </>
                ) : props.onOpenRegistry && (
                    <button type="button" class="pb-pop-button pb-shp-push" onClick={props.onOpenRegistry}>
                        Open extensions.yml
                    </button>
                )}
            </footer>
            {narrow && <Sheet box={box} onClose={props.onClose} />}
        </div>
    );

    if (!narrow) { return body; }
    return (
        <div class="pb-sheet-layer">
            <div class="pb-sheet-scrim" aria-hidden="true" onClick={props.onClose} />
            {body}
        </div>
    );
}
