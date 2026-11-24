/** The mark for each kind of hook, and the gate's diamond, drawn rather than typed. */
import { HookType } from '../../../src/protocol/pipeline';

const PATHS: Record<HookType, string[]> = {
    skill: [
        'M1.5 2.5C3.5 2 5.5 2.2 7 3.5C8.5 2.2 10.5 2 12.5 2.5V11C10.5 10.5 8.5 10.7 7 12C5.5 10.7 3.5 10.5 1.5 11Z',
        'M7 3.5V12',
    ],
    prompt: ['M2 3.5H12M2 7H12M2 10.5H8'],
    command: ['M2 3.5L6 7L2 10.5M7.5 11H12'],
    node: ['M3 1.5H8L11 4.5V12.5H3ZM8 1.5V4.5H11'],
};

export function HookIcon({ type }: { type: HookType }) {
    return (
        <svg class="pb-hook-icon" width="14" height="14" viewBox="0 0 14 14" fill="none"
            stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
            stroke-linejoin="round" aria-hidden="true" focusable="false">
            {(PATHS[type] ?? PATHS.prompt).map(d => <path key={d} d={d} />)}
        </svg>
    );
}

export function GateIcon() {
    return (
        <svg class="pb-gate-mark" width="14" height="14" viewBox="0 0 14 14" fill="none"
            stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"
            aria-hidden="true" focusable="false">
            <path d="M7 1.5L12.5 7L7 12.5L1.5 7Z" />
        </svg>
    );
}
