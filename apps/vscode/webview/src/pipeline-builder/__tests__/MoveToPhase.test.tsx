/**
 * @jest-environment jsdom
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { Inspector } from '../Inspector';
import { placeFloating } from '../Menu';
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

describe('the Move to phase… list in a narrow panel', () => {
    const noop = () => undefined;
    const actions = {
        onClose: noop, onOpenFile: noop, onSave: noop, onRestore: noop, onAttach: noop,
        onUseVariant: noop, onRemove: noop, onMove: noop, editable: 'x',
    };
    const wrapUp = step({
        phases: [
            { name: 'gather', hooks: [], nodes: [node({ id: 'resolve-dir' })] },
            { name: 'author', hooks: [], nodes: [node({ id: 'draft-spec' })] },
            { name: 'classify', hooks: [], nodes: [node({ id: 'classify-size' })] },
            { name: 'wrap-up', hooks: [], nodes: [
                node({ id: 'branch', name: 'Create the feature branch' }), node({ id: 'handoff' }),
            ] },
        ],
    });

    function inspect(onMoveToPhase: (phase: string) => void = noop) {
        return mount(
            <Inspector node={wrapUp.phases[3].nodes[0]} step="specify" body="x" parts={[]}
                {...actions} moveTargets={moveTargets(wrapUp, 'branch')}
                onMoveToPhase={onMoveToPhase} />);
    }

    const trigger = (host: HTMLElement) => Array.from(
        host.querySelectorAll<HTMLButtonElement>('.pb-order-move'))
        .find(el => el.textContent?.startsWith('Move to phase'))!;

    const rect = (left: number, top: number, width: number, height: number) => ({
        left, top, width, height, right: left + width, bottom: top + height, x: left, y: top,
        toJSON: () => ({}),
    }) as DOMRect;

    function viewport(width: number, height: number) {
        Object.defineProperty(document.documentElement, 'clientWidth',
            { configurable: true, value: width });
        Object.defineProperty(document.documentElement, 'clientHeight',
            { configurable: true, value: height });
    }

    /** A list of `height` px that a fixed box at 0,0 measures from the viewport origin. */
    function sized(list: HTMLElement, width: number, height: number) {
        Object.defineProperty(list, 'scrollHeight', { configurable: true, value: height });
        list.getBoundingClientRect = () => rect(0, 0, width, Math.min(
            height, parseFloat(list.style.maxHeight) || height));
    }

    afterEach(() => {
        delete (document.documentElement as unknown as Record<string, unknown>).clientWidth;
        delete (document.documentElement as unknown as Record<string, unknown>).clientHeight;
    });

    it('is offered at every width, since nothing in it reads the width', () => {
        viewport(330, 600);
        expect(trigger(inspect())).toBeDefined();
    });

    it('lists every phase the node is not in', async () => {
        const host = inspect();
        trigger(host).click();
        await flush();
        expect(Array.from(host.querySelectorAll('.pb-menu-label')).map(l => l.textContent))
            .toEqual(['gather', 'author', 'classify']);
    });

    it('floats out of the pane that clips it', async () => {
        const host = inspect();
        trigger(host).click();
        await flush();
        expect(host.querySelector('.pb-menu-list')!.classList)
            .toContain('pb-menu-list--floating');
    });

    it('is a named menu the keyboard opens, walks and closes', async () => {
        const host = inspect();
        const button = trigger(host);
        expect(button.getAttribute('aria-haspopup')).toBe('menu');
        button.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
        const menu = host.querySelector('[role="menu"]')!;
        expect(menu.getAttribute('aria-label')).toBe('Put this node in another phase of the step');
        const rows = Array.from(menu.querySelectorAll<HTMLElement>('[role="menuitem"]'));
        expect(document.activeElement).toBe(rows[0]);
        menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
        expect(document.activeElement).toBe(rows[2]);
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        await flush();
        expect(host.querySelector('[role="menu"]')).toBeNull();
        expect(document.activeElement).toBe(button);
    });

    it('reports an allowed move to the phase picked', async () => {
        const picked: string[] = [];
        const host = inspect(phase => picked.push(phase));
        trigger(host).click();
        await flush();
        Array.from(host.querySelectorAll<HTMLButtonElement>('.pb-menu-option'))[2].click();
        await flush();
        expect(picked).toEqual(['classify']);
        expect(host.querySelector('.pb-live')?.textContent)
            .toBe('Create the feature branch moved to classify in specify.');
        expect(movedToPhase(wrapUp, 'branch', 'classify')!.phases[2])
            .toEqual({ name: 'classify', nodes: ['classify-size', 'branch'] });
    });

    it('opens above a trigger near the bottom and stays inside the left edge', () => {
        viewport(330, 600);
        const list = document.createElement('ul');
        const button = document.createElement('button');
        button.getBoundingClientRect = () => rect(20, 540, 100, 27);
        sized(list, 300, 160);
        placeFloating(list, button, 'right');
        expect(list.dataset.side).toBe('above');
        expect(parseFloat(list.style.left)).toBe(8);
        expect(parseFloat(list.style.top)).toBe(540 - 4 - 160);
        expect(parseFloat(list.style.maxWidth)).toBe(314);
    });

    it('opens below when the whole list fits there', () => {
        viewport(480, 760);
        const list = document.createElement('ul');
        const button = document.createElement('button');
        button.getBoundingClientRect = () => rect(350, 100, 100, 27);
        sized(list, 220, 160);
        placeFloating(list, button, 'right');
        expect(list.dataset.side).toBe('below');
        expect(parseFloat(list.style.top)).toBe(131);
        expect(parseFloat(list.style.left)).toBe(450 - 220);
    });

    it('caps its height to the roomier side, so a long list scrolls', () => {
        viewport(330, 400);
        const list = document.createElement('ul');
        const button = document.createElement('button');
        button.getBoundingClientRect = () => rect(20, 250, 100, 27);
        sized(list, 300, 900);
        placeFloating(list, button, 'left');
        expect(list.dataset.side).toBe('above');
        expect(parseFloat(list.style.maxHeight)).toBe(250 - 4 - 8);
        expect(parseFloat(list.style.top)).toBeGreaterThanOrEqual(8);
    });

    // jsdom has no cascade, so the narrow layout is read from the sheet.
    it('scrolls the whole inspector when it is stacked under the board', () => {
        const css = readFileSync(
            join(__dirname, '..', '..', '..', 'styles', 'pipeline-builder.css'), 'utf8');
        const narrow = css.slice(css.lastIndexOf('@container builder (max-width: 860px)'));
        const pane = /\n {4}\.pb-inspector \{([^}]*grid-template-rows[^}]*)\}/.exec(narrow)?.[1] ?? '';
        expect(pane).toMatch(/overflow-y:\s*auto/);
        expect(pane).not.toMatch(/minmax\(0/);
        expect(narrow).toMatch(/\.pb-inspector \.pb-inspector-actions \{ position: sticky; \}/);
        expect(css).toMatch(/\.pb-menu-list--floating \{[^}]*position: fixed/);
    });
});
