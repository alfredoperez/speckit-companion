import { HookWhen } from '../../../src/protocol/pipeline';

/** Its own type, so a node's drop handlers, which read `text/plain`, never see a hook. */
export const HOOK_DRAG = 'application/x-pb-hook';

/** Where one of the project's hooks is written, as the board drew it. */
export interface HookAddress {
    command: string;
    when: HookWhen;
    anchor: string;
    index: number;
    /** A phase and a node can share a name, so the list a hook sits in is named by both. */
    boundary: 'node' | 'phase';
}

export interface HookTarget {
    when: HookWhen;
    anchor: string;
    /** The slot in the target's list as drawn, 0 to its length; absent means last. */
    place?: number;
    boundary: 'node' | 'phase';
}

export type HookMove = { when: HookWhen; anchor: string; index?: number; boundary: 'node' | 'phase' };

export function writeHookDrag(data: DataTransfer | null, from: HookAddress): void {
    data?.setData(HOOK_DRAG, JSON.stringify(from));
    if (data) { data.effectAllowed = 'move'; }
}

export function isHookDrag(data: DataTransfer | null): boolean {
    return Array.from(data?.types ?? []).includes(HOOK_DRAG);
}

export function readHookDrag(data: DataTransfer | null): HookAddress | null {
    try {
        const parsed = JSON.parse(data?.getData(HOOK_DRAG) || 'null');
        return parsed && typeof parsed.anchor === 'string' && Number.isInteger(parsed.index)
            ? parsed as HookAddress : null;
    } catch {
        return null;
    }
}

/** Whether a pointer at `y` is over the upper half of a box. */
export function upperHalf(y: number, box: { top: number; height: number }): boolean {
    return y < box.top + box.height / 2;
}

/** Where a dropped hook lands as the writer counts it (after taking it out), or null when it would not move. */
export function hookMove(from: HookAddress, target: HookTarget, count: number): HookMove | null {
    const { when, anchor, boundary } = target;
    if (from.when !== when || from.anchor !== anchor || from.boundary !== boundary) {
        return target.place === undefined
            ? { when, anchor, boundary }
            : { when, anchor, index: target.place, boundary };
    }
    const slot = target.place ?? count;
    const index = slot > from.index ? slot - 1 : slot;
    return index === from.index ? null : { when, anchor, index, boundary };
}
