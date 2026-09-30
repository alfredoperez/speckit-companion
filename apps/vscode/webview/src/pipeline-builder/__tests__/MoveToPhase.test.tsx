/**
 * @jest-environment jsdom
 */
import { Inspector } from '../Inspector';
import { moveTargets, movedToPhase } from '../moves';
import { flush, mount, node, step } from './support';

afterEach(() => { document.body.innerHTML = ''; });

const three = () => step({
    phases: [
        { name: 'gather', hooks: [], nodes: [node({ id: 'a' }), node({ id: 'b' })] },
        { name: 'author', hooks: [], nodes: [node({ id: 'c' })] },
        { name: 'check', hooks: [], nodes: [node({ id: 'd' }), node({ id: 'e' })] },
    ],
});

describe('the phases a node can move to', () => {
    it('lists every phase but its own, in run order', () => {
        expect(moveTargets(three(), 'c').map(t => t.phase)).toEqual(['gather', 'check']);
    });

    it('says which edge the node would join', () => {
        expect(moveTargets(three(), 'c')).toEqual([
            { phase: 'gather', joins: 'end' },
            { phase: 'check', joins: 'start' },
        ]);
    });

    it('offers nothing for a node the step does not have', () => {
        expect(moveTargets(three(), 'nope')).toEqual([]);
    });

    it('offers nothing in a step with one phase', () => {
        const only = step({ phases: [{ name: 'gather', hooks: [], nodes: [node({ id: 'a' })] }] });
        expect(moveTargets(only, 'a')).toEqual([]);
    });
});

describe('moving a node into another phase', () => {
    it('moves a node from the middle of its phase past its neighbours', () => {
        const shape = movedToPhase(three(), 'a', 'author')!;
        expect(shape.order).toEqual(['b', 'a', 'c', 'd', 'e']);
    });

    it('leaves the order alone when an edge node moves to the phase next door', () => {
        const shape = movedToPhase(three(), 'c', 'gather')!;
        expect(shape.order).toEqual(['a', 'b', 'c', 'd', 'e']);
        expect(shape.phases).toEqual([
            { name: 'gather', nodes: ['a', 'b', 'c'] },
            { name: 'check', nodes: ['d', 'e'] },
        ]);
    });

    it('joins the start of a phase below it', () => {
        const shape = movedToPhase(three(), 'b', 'author')!;
        expect(shape.phases[1]).toEqual({ name: 'author', nodes: ['b', 'c'] });
        expect(shape.order).toEqual(['a', 'b', 'c', 'd', 'e']);
    });

    it('joins the end of a phase above it', () => {
        const shape = movedToPhase(three(), 'd', 'author')!;
        expect(shape.phases[1]).toEqual({ name: 'author', nodes: ['c', 'd'] });
        expect(shape.order).toEqual(['a', 'b', 'c', 'd', 'e']);
    });

    it('drops the phase it empties, since an empty phase cannot be written', () => {
        const shape = movedToPhase(three(), 'c', 'check')!;
        expect(shape.phases.map(p => p.name)).toEqual(['gather', 'check']);
        expect(shape.phases[1].nodes).toEqual(['c', 'd', 'e']);
    });

    it('refuses the phase it is already in, an unknown phase and an unknown node', () => {
        expect(movedToPhase(three(), 'a', 'gather')).toBeNull();
        expect(movedToPhase(three(), 'a', 'nowhere')).toBeNull();
        expect(movedToPhase(three(), 'nope', 'check')).toBeNull();
    });

    it('does not change the step it was given', () => {
        const s = three();
        movedToPhase(s, 'a', 'check');
        expect(s.phases[0].nodes.map(n => n.id)).toEqual(['a', 'b']);
    });
});

describe('the inspector offers Move to phase…', () => {
    const noop = () => undefined;
    const actions = {
        onClose: noop, onOpenFile: noop, onSave: noop, onRestore: noop, onAttach: noop,
        onUseVariant: noop, onRemove: noop, onMove: noop, editable: 'x',
    };
    const targets = [
        { phase: 'gather', joins: 'end' as const },
        { phase: 'check', joins: 'start' as const },
    ];

    const trigger = (host: HTMLElement) => Array.from(
        host.querySelectorAll<HTMLButtonElement>('.pb-order-move'))
        .find(el => el.textContent?.startsWith('Move to phase'));

    it('lists the other phases and reports the one picked', async () => {
        const picked: string[] = [];
        const host = mount(
            <Inspector node={node({ id: 'c', name: 'Write it' })} step="specify" body="x"
                parts={[]} {...actions} moveTargets={targets}
                onMoveToPhase={phase => picked.push(phase)} />);
        trigger(host)!.click();
        await flush();
        const rows = Array.from(host.querySelectorAll<HTMLButtonElement>('.pb-menu-option'));
        expect(rows.map(r => r.querySelector('.pb-menu-label')?.textContent))
            .toEqual(['gather', 'check']);
        expect(rows[0].querySelector('.pb-menu-note')?.textContent).toBe('Joins the end of it');
        rows[1].click();
        await flush();
        expect(picked).toEqual(['check']);
        expect(host.querySelector('.pb-live')?.textContent)
            .toBe('Write it moved to check in specify.');
    });

    it('is absent for a held node, which has no targets to offer', () => {
        const host = mount(
            <Inspector node={node({ pinned: 'draft-spec reads it' })} step="specify" body="x"
                parts={[]} {...actions} moveTargets={[]} onMoveToPhase={noop} />);
        expect(trigger(host)).toBeUndefined();
    });

    it('is absent in a step with one phase', () => {
        const host = mount(
            <Inspector node={node()} step="specify" body="x" parts={[]} {...actions}
                moveTargets={[]} onMoveToPhase={noop} />);
        expect(trigger(host)).toBeUndefined();
    });
});
