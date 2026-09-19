/**
 * What each kind of hook is called, in the words a person reads.
 *
 * The form said `Instruction` and the board said `prompt` — the same four
 * things named twice, so a fifth kind would have been labelled in one place and
 * left raw in the other.
 */
import { HookType } from '../../../src/protocol/pipeline';

export const KIND_LABELS: Record<HookType, string> = {
    skill: 'Skill',
    prompt: 'Instruction',
    command: 'Command',
    node: 'Node',
};
