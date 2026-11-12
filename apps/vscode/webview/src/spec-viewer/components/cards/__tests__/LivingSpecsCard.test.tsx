/**
 * @jest-environment jsdom
 *
 * An old record's `livingSpecs` block still renders as a compact list of
 * plain-text capability chips under "Updated by this run" or "Read for
 * context". A chip is text: it posts no message. With no data the card renders nothing.
 */

import { render } from 'preact';
import { LivingSpecsCard } from '../LivingSpecsCard';
import type { ViewerState } from '../../../types';

function baseState(over: Partial<ViewerState> = {}): ViewerState {
    return {
        status: 'implemented',
        activeStep: 'implement',
        steps: {},
        pulse: null,
        highlights: [],
        activeSubstep: null,
        footer: [],
        history: [],
        stepHistory: {},
        ...over,
    };
}

const mounted: HTMLDivElement[] = [];

function renderCard(state: ViewerState): HTMLDivElement {
    const container = document.createElement('div');
    document.body.appendChild(container);
    mounted.push(container);
    render(<LivingSpecsCard state={state} />, container);
    return container;
}

function cleanup(container: HTMLDivElement) {
    render(null, container);
    container.remove();
}

describe('LivingSpecsCard', () => {
    afterEach(() => {
        while (mounted.length) cleanup(mounted.pop()!);
        delete (globalThis as { vscode?: unknown }).vscode;
    });

    const groups = (c: HTMLElement) =>
        Array.from(c.querySelectorAll('.living-specs-group')).map(g => ({
            label: g.querySelector('.living-specs-group__label')?.textContent,
            chips: Array.from(g.querySelectorAll('.living-specs-chip')).map(n => n.textContent),
        }));

    it('lists loaded-only capabilities under Read for context, by readable name', () => {
        const c = renderCard(baseState({ livingSpecs: { loaded: ['checkout', 'commands-living-load'], synced: [] } }));
        expect(groups(c)).toEqual([{ label: 'Read for context', chips: ['Checkout', 'Commands Living Load'] }]);
    });

    it('splits synced from loaded-only, synced first, with no per-chip stamp', () => {
        const c = renderCard(baseState({ livingSpecs: { loaded: ['checkout', 'cart'], synced: ['checkout'] } }));
        expect(groups(c)).toEqual([
            { label: 'Updated by this run', chips: ['Checkout'] },
            { label: 'Read for context', chips: ['Cart'] },
        ]);
        expect(c.textContent?.toLowerCase()).not.toContain('folded back');
    });

    it('omits Read for context when every capability was synced', () => {
        const c = renderCard(baseState({ livingSpecs: { loaded: [], synced: ['checkout'] } }));
        expect(groups(c)).toEqual([{ label: 'Updated by this run', chips: ['Checkout'] }]);
    });

    it('renders an old record\'s names as plain text and posts no openLivingSpec message', () => {
        const postMessage = jest.fn();
        (globalThis as { vscode?: unknown }).vscode = { postMessage };
        const c = renderCard(
            baseState({ livingSpecs: { loaded: ['todos', 'ghost'], synced: ['todos'] } }),
        );
        const chips = Array.from(c.querySelectorAll('.living-specs-chip'));
        expect(chips.map(n => n.textContent)).toEqual(['Todos', 'Ghost']);
        expect(c.querySelector('button, a')).toBeNull();
        for (const chip of chips) (chip as HTMLElement).click();
        expect(postMessage).not.toHaveBeenCalled();
    });

    it('renders nothing when there is no livingSpecs data', () => {
        const c = renderCard(baseState());
        expect(c.querySelector('.activity-card--living-specs')).toBeNull();
        expect(c.textContent).toBe('');
    });
});
