// Small pieces the stock board, its hook popover and its modals share.
import { StockHookRow } from '../../../src/protocol/pipeline';

/** A hook's address in the registry, as a string a row and its popover agree on. */
export function hookKey(hook: StockHookRow): string {
    return `${hook.step}/${hook.when}/${hook.index}`;
}

/** What a hook is called: the command it runs, else its description, else whose it is. */
export function hookTitle(hook: StockHookRow): string {
    return hook.command.trim() || hook.description.trim() || `A hook from ${hook.extension}`;
}

/** The quiet line under a hook's name: whose it is, and whether it is off. How it asks is the popover's. */
export function hookMeta(hook: StockHookRow): string {
    return [
        hook.own ? 'yours' : `from ${hook.extension}`,
        !hook.enabled && 'off',
    ].filter(Boolean).join(' · ');
}

export function PlugIcon() {
    return (
        <svg class="pb-hook-icon pb-plug" width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
            aria-hidden="true" focusable="false">
            <path d="M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0zM12 17v4" />
        </svg>
    );
}

export function FileIcon() {
    return (
        <svg class="pb-sd-file-icon" width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
            aria-hidden="true" focusable="false">
            <path d="M6 3h8l4 4v14H6zM14 3v4h4" />
        </svg>
    );
}

/** A hook's on/off switch, written straight to the registry. */
export function HookSwitch({ hook, onToggle, label }: {
    hook: StockHookRow;
    onToggle: () => void;
    /** Draw the state as a word beside it. */
    label?: boolean;
}) {
    return (
        <button type="button" role="switch" aria-checked={hook.enabled}
            class={`pb-switch${hook.enabled ? ' pb-switch--on' : ''}`}
            aria-label={`${hookTitle(hook)}, ${hook.when} ${hook.step}`}
            onClick={onToggle}>
            <span class="pb-switch-track" aria-hidden="true"><span class="pb-switch-thumb" /></span>
            {label && <span class="pb-switch-word" aria-hidden="true">{hook.enabled ? 'On' : 'Off'}</span>}
        </button>
    );
}
