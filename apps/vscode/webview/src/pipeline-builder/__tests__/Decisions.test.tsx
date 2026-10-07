/**
 * @jest-environment jsdom
 */
import { DecisionForm } from '../DecisionForm';
import type { PipelineDecision } from '../../../../src/protocol/pipeline';
import { canvas, flush, graph, mount, step } from './support';

afterEach(() => { document.body.innerHTML = ''; });

const DECISION: PipelineDecision = {
    node: 'classify-size',
    verdicts: [
        { name: 'simple', folds: ['plan', 'tasks'], warns: '' },
        { name: 'normal', folds: [], warns: '' },
        { name: 'oversized', folds: [], warns: 'Oversized change — running everything' },
    ],
};

describe('the board says where a verdict routes, and offers the change', () => {
    it('reads each verdict as a sentence rather than as the key it is written under', () => {
        const { host } = canvas(graph({
            steps: [step({ decisions: [DECISION] })],
        }));
        const read = Array.from(host.querySelectorAll('.pb-verdicts li'))
            .map(el => el.textContent ?? '');
        expect(read[0]).toContain('skips plan, tasks');
        expect(read[1]).toContain('runs everything');
        expect(read[2]).toContain('warns, then runs everything');
    });

    it('marks the verdicts this project changed', () => {
        const { host } = canvas(graph({
            steps: [step({
                decisions: [DECISION],
                changes: {
                    added: [], removed: [], reordered: false, hooks: 0,
                    decisions: ['classify-size.simple'], replaced: [], phases: [],
                },
            })],
        }));
        const marked = Array.from(host.querySelectorAll('.pb-verdicts li'))
            .filter(el => el.querySelector('.pb-yours'))
            .map(el => el.querySelector('.pb-verdict')?.textContent);
        expect(marked).toEqual(['simple']);
    });

    // The routing was drawn and could only be read; the override that changes
    // it had shipped the whole time.
    it('opens the routing for the node that decides', () => {
        const { host, decisions } = canvas(graph({
            steps: [step({ decisions: [DECISION] })],
        }));
        host.querySelector<HTMLButtonElement>('.pb-decision-edit')?.click();
        expect(decisions).toEqual([['specify', 'classify-size']]);
    });

    it('draws nothing for a step that decides nothing', () => {
        const { host } = canvas();
        expect(host.querySelector('.pb-decisions')).toBeNull();
        expect(host.querySelector('.pb-decision-edit')).toBeNull();
    });
});

describe('the decision pane edits where each verdict routes', () => {
    const noop = () => undefined;
    const SKIPPABLE = ['plan', 'tasks', 'implement'];

    function open(over: Partial<Parameters<typeof DecisionForm>[0]> = {}) {
        const saved: Array<[string, string[], string]> = [];
        const restored: string[] = [];
        const host = mount(
            <DecisionForm step={step()} decision={DECISION} skippable={SKIPPABLE}
                changed={[]} onCancel={noop}
                onSave={(verdict, folds, warns) => saved.push([verdict, folds, warns])}
                onRestore={verdict => restored.push(verdict)}
                {...over} />,
        );
        return { host, saved, restored };
    }

    /** One verdict's row, by the order the deciding node declares them. */
    function row(host: HTMLElement, at: number): HTMLElement {
        return host.querySelectorAll<HTMLElement>('.pb-verdict-row')[at];
    }

    function boxes(host: HTMLElement, at: number): HTMLInputElement[] {
        return Array.from(row(host, at).querySelectorAll('input[type=checkbox]'));
    }

    it('offers one row per verdict the node can answer, and no way to add another', () => {
        const { host } = open();
        expect(host.querySelectorAll('.pb-verdict-row')).toHaveLength(3);
        expect(host.textContent).toContain('classify-size');
        expect(host.textContent).not.toContain('Add a verdict');
    });

    it('starts each row from the routing in force', () => {
        const { host } = open();
        expect(boxes(host, 0).filter(b => b.checked).map(b => b.parentElement?.textContent))
            .toEqual(['plan', 'tasks']);
        expect(boxes(host, 1).filter(b => b.checked)).toHaveLength(0);
    });

    it('cannot offer the step that decides as something to skip', () => {
        const { host } = open({ skippable: SKIPPABLE });
        const offered = boxes(host, 0).map(b => b.parentElement?.textContent);
        expect(offered).not.toContain('specify');
    });

    it('saves nothing until something changes', () => {
        const { host } = open();
        const save = row(host, 0).querySelector<HTMLButtonElement>('.pb-action--primary');
        expect(save?.disabled).toBe(true);
    });

    it('sends both halves of the routing, in run order', async () => {
        const { host, saved } = open();
        // Ticked out of order: the written list is something to read, so it
        // follows the run rather than the clicks.
        boxes(host, 1)[2].click();
        boxes(host, 1)[0].click();
        await flush();
        row(host, 1).querySelector<HTMLButtonElement>('.pb-action--primary')?.click();
        expect(saved).toEqual([['normal', ['plan', 'implement'], '']]);
    });

    it('sends the notice a verdict prints', async () => {
        const { host, saved } = open();
        const input = row(host, 1).querySelector<HTMLInputElement>('input[type=text]')!;
        input.value = 'Check with the team first';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await flush();
        row(host, 1).querySelector<HTMLButtonElement>('.pb-action--primary')?.click();
        expect(saved).toEqual([['normal', [], 'Check with the team first']]);
    });

    it('restates the routing as it will read once saved', async () => {
        const { host } = open();
        boxes(host, 1)[1].click();
        await flush();
        expect(row(host, 1).querySelector('.pb-verdict-route')?.textContent)
            .toBe('skips tasks');
    });

    it('offers the shipped routing back only for a verdict this project changed', () => {
        const { host, restored } = open({ changed: ['classify-size.oversized'] });
        expect(row(host, 0).querySelector('.pb-action--remove')).toBeNull();
        row(host, 2).querySelector<HTMLButtonElement>('.pb-action--remove')?.click();
        expect(restored).toEqual(['oversized']);
    });

    it('says the answers come from the node, not from here', () => {
        const { host } = open();
        expect(host.textContent).toContain('companion.yml');
        expect(host.textContent).toContain('not what can be answered');
    });
});
