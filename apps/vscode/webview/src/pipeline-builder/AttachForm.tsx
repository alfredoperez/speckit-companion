/**
 * The shared shape of a hook write. Adding a hook, a node or a step happens in `HookModal`.
 */

import { HookType, HookWhen, PipelineStep } from '../../../src/protocol/pipeline';

export interface Attachment {
    anchor: string;
    when: HookWhen;
    hookType: HookType;
    value: string;
    note: string;
    /** Set when this replaces a hook in place, at the anchor it already had. */
    editIndex?: number;
    /** Where the hook was, when the edit moved it: an index belongs to its anchor, so this is a move, not a replace. */
    movedFrom?: { anchor: string; when: HookWhen; index: number };
    /** Whether `anchor` names a node or a phase, since the two can share a name. */
    boundary: 'node' | 'phase';
}

/** A node wins a name it shares with a phase, which is the order the writer resolves it in. */
export function boundaryOf(step: PipelineStep, anchor: string): 'node' | 'phase' {
    return step.phases.some(p => p.nodes.some(n => n.id === anchor)) ? 'node' : 'phase';
}
