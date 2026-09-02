/**
 * @jest-environment jsdom
 */
import type { PipelineChanges } from '../../../../src/protocol/pipeline';
import { changed } from '../changes';
import { step } from './support';

/**
 * Every field `pipeline-graph.py` counts, typed so the protocol gaining one
 * stops compiling here before it can go uncounted.
 */
const NOTHING: PipelineChanges = {
    added: [], removed: [], reordered: false, hooks: 0,
    decisions: [], replaced: [], phases: [],
};

/** Whatever this field's type is, a value meaning "the project changed it". */
function some(current: unknown): unknown {
    if (Array.isArray(current)) { return ['draft-spec']; }
    if (typeof current === 'number') { return 1; }
    return true;
}

const TEMPLATE = {
    file: 'spec-template.md', sections: [], sectionsAvailable: ['Requirements'], chosenBy: {},
};

describe('what counts as a step this project changed', () => {
    it('counts nothing when every field is at its shipped value', () => {
        expect(changed(step({ changes: { ...NOTHING } }))).toBe(false);
    });

    for (const field of Object.keys(NOTHING) as Array<keyof PipelineChanges>) {
        it(`counts ${field}`, () => {
            const changes = { ...NOTHING, [field]: some(NOTHING[field]) } as PipelineChanges;
            expect(changed(step({ changes }))).toBe(true);
        });
    }

    it('counts a template section the project replaced', () => {
        expect(changed(step({
            changes: { ...NOTHING },
            template: { ...TEMPLATE, sections: ['Requirements'] },
        }))).toBe(true);
    });

    it('does not count a template nobody replaced', () => {
        expect(changed(step({ changes: { ...NOTHING }, template: { ...TEMPLATE } }))).toBe(false);
    });
});
