import { movePlaces } from '../moves';
import { node, step } from './support';

const plan = () => step({
    name: 'plan',
    phases: [
        { name: 'author', hooks: [], nodes: [
            node({ id: 'write', name: 'Write the plan' }),
            node({ id: 'pick', name: 'Pick the blocks', reads: ['write'] }),
        ] },
        { name: 'check', hooks: [], nodes: [node({ id: 'check', name: 'Check it' })] },
        { name: 'wrap-up', hooks: [], nodes: [
            node({ id: 'handoff', name: 'Hand off', pinned: 'it hands off to the next step, so nothing can run after it' }),
        ] },
    ],
});

describe('where a node can be moved', () => {
    it('offers up, down and each other phase, in the words the popover shows', () => {
        const { places } = movePlaces(plan(), 'pick');
        expect(places.map(p => [p.id, p.label])).toEqual([
            ['up', 'Up, above Write the plan'],
            ['phase:check', 'To phase check, first'],
            ['phase:wrap-up', 'To phase wrap-up, first'],
        ]);
    });

    it('refuses a place before a node it reads, in the writer\'s words', () => {
        const up = movePlaces(plan(), 'pick').places.find(p => p.id === 'up')!;
        expect(up.refused).toBe('It reads Write the plan, so it cannot run before it.');
    });

    it('refuses a place after a node that reads it', () => {
        const down = movePlaces(plan(), 'write').places.find(p => p.id === 'down')!;
        expect(down.refused).toBe('Pick the blocks reads it, so it cannot run after Pick the blocks.');
    });

    it('refuses a place that would shift a held node, and marks held nodes', () => {
        const { places, held } = movePlaces(plan(), 'check');
        expect(places.find(p => p.id === 'phase:wrap-up')!.refused).toBe('');
        expect(held).toEqual(['Hand off is held in place: it hands off to the next step, so nothing can run after it.']);

        const across = step({
            phases: [
                { name: 'a', hooks: [], nodes: [node({ id: 'x', name: 'X' })] },
                { name: 'b', hooks: [], nodes: [node({ id: 'h', name: 'Held', pinned: 'reasons' })] },
                { name: 'c', hooks: [], nodes: [node({ id: 'z', name: 'Z' })] },
            ],
        });
        const xs = movePlaces(across, 'x').places;
        expect(xs.find(p => p.id === 'phase:b')!.refused).toBe('');
        expect(xs.find(p => p.id === 'phase:c')!.refused)
            .toBe('Held is held in place, so nothing goes after it.');
    });

    it('offers no place for a held node, and says why', () => {
        expect(movePlaces(plan(), 'handoff')).toEqual({
            places: [], held: [], pinned: 'it hands off to the next step, so nothing can run after it',
        });
    });
});
