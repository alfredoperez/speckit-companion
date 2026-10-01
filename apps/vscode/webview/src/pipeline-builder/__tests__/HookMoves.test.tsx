import { HOOK_DRAG, HookAddress, hookMove, isHookDrag, readHookDrag, upperHalf, writeHookDrag } from '../hookMoves';

const from: HookAddress = { command: 'plan', when: 'after', anchor: 'draft', index: 1, boundary: 'node' };

function transfer(): DataTransfer {
    const store = new Map<string, string>();
    return {
        get types() { return Array.from(store.keys()); },
        setData: (type: string, value: string) => { store.set(type, value); },
        getData: (type: string) => store.get(type) ?? '',
        effectAllowed: 'all',
    } as unknown as DataTransfer;
}

describe('where a dropped hook lands', () => {
    it('keeps the slot it was dropped in when it changes anchor', () => {
        expect(hookMove(from, { when: 'before', anchor: 'review', place: 2, boundary: 'node' }, 3))
            .toEqual({ when: 'before', anchor: 'review', index: 2, boundary: 'node' });
    });

    it('goes last at another anchor when no slot was named', () => {
        expect(hookMove(from, { when: 'after', anchor: 'author', boundary: 'phase' }, 0))
            .toEqual({ when: 'after', anchor: 'author', boundary: 'phase' });
    });

    it('counts one fewer below its own place, since it leaves before it lands', () => {
        expect(hookMove(from, { when: 'after', anchor: 'draft', place: 3, boundary: 'node' }, 3))
            .toEqual(expect.objectContaining({ index: 2 }));
    });

    it('moves up its own list by the slot it was dropped in', () => {
        expect(hookMove(from, { when: 'after', anchor: 'draft', place: 0, boundary: 'node' }, 3))
            .toEqual(expect.objectContaining({ index: 0 }));
    });

    it('is no move when it is dropped on either side of itself', () => {
        const at = (place: number) => hookMove(from,
            { when: 'after', anchor: 'draft', place, boundary: 'node' }, 3);
        expect(at(1)).toBeNull();
        expect(at(2)).toBeNull();
    });

    it('is a move, for the writer to judge, onto a phase that shares its node\'s name', () => {
        expect(hookMove(from, { when: 'after', anchor: 'draft', place: 1, boundary: 'phase' }, 0))
            .toEqual({ when: 'after', anchor: 'draft', index: 1, boundary: 'phase' });
    });

    it('is no move when the last hook is sent to the end of its own list', () => {
        expect(hookMove({ ...from, index: 2 },
            { when: 'after', anchor: 'draft', boundary: 'node' }, 3)).toBeNull();
    });
});

describe('the drag payload', () => {
    it('round-trips under its own type and leaves text/plain alone', () => {
        const data = transfer();
        writeHookDrag(data, from);
        expect(isHookDrag(data)).toBe(true);
        expect(data.getData('text/plain')).toBe('');
        expect(readHookDrag(data)).toEqual(from);
    });

    it('reads nothing from a drag that is not a hook', () => {
        const data = transfer();
        data.setData('text/plain', 'draft-spec');
        expect(isHookDrag(data)).toBe(false);
        expect(readHookDrag(data)).toBeNull();
        data.setData(HOOK_DRAG, '{not json');
        expect(readHookDrag(data)).toBeNull();
    });
});

describe('which half the pointer is over', () => {
    it('splits a box at its middle', () => {
        expect(upperHalf(10, { top: 0, height: 40 })).toBe(true);
        expect(upperHalf(30, { top: 0, height: 40 })).toBe(false);
    });
});
