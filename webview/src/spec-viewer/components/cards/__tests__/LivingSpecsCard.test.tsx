/**
 * @jest-environment jsdom
 *
 * LS·7 — the Living specs card maps `ViewerState.livingSpecs` to the DOM:
 * loaded capabilities render; the ones in `synced` are marked folded back;
 * with no living-specs data the card renders nothing.
 *
 * This asserts the data→DOM mapping, not the visual look (NFR-004 — the look
 * needs manual verification).
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

function renderCard(state: ViewerState): HTMLDivElement {
    const container = document.createElement('div');
    document.body.appendChild(container);
    render(<LivingSpecsCard state={state} />, container);
    return container;
}

function cleanup(container: HTMLDivElement) {
    render(null, container);
    container.remove();
}

describe('LivingSpecsCard', () => {
    it('lists loaded capabilities and no folded-back marker when nothing synced', () => {
        const c = renderCard(baseState({ livingSpecs: { loaded: ['checkout', 'cart'], synced: [] } }));
        const names = Array.from(c.querySelectorAll('.living-specs-list__name')).map(n => n.textContent);
        expect(names).toEqual(['checkout', 'cart']);
        expect(c.querySelectorAll('.living-specs-list__synced')).toHaveLength(0);
        cleanup(c);
    });

    it('marks synced capabilities as folded back', () => {
        const c = renderCard(baseState({ livingSpecs: { loaded: ['checkout', 'cart'], synced: ['checkout'] } }));
        const items = Array.from(c.querySelectorAll('.living-specs-list__item'));
        const checkout = items.find(li => li.querySelector('.living-specs-list__name')?.textContent === 'checkout');
        const cart = items.find(li => li.querySelector('.living-specs-list__name')?.textContent === 'cart');
        expect(checkout?.querySelector('.living-specs-list__synced')).not.toBeNull();
        expect(cart?.querySelector('.living-specs-list__synced')).toBeNull();
        cleanup(c);
    });

    it('includes a synced capability that was not loaded this run', () => {
        const c = renderCard(baseState({ livingSpecs: { loaded: ['cart'], synced: ['checkout'] } }));
        const names = Array.from(c.querySelectorAll('.living-specs-list__name')).map(n => n.textContent);
        expect(names).toEqual(['cart', 'checkout']);
        cleanup(c);
    });

    it('renders nothing when there is no livingSpecs data', () => {
        const c = renderCard(baseState());
        expect(c.querySelector('.activity-card--living-specs')).toBeNull();
        expect(c.textContent).toBe('');
        cleanup(c);
    });
});
