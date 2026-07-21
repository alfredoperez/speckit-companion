/**
 * @jest-environment jsdom
 *
 * LS·7 — the Living specs run-log card maps `ViewerState.livingSpecs` to a
 * COMPACT list of clickable capability chips: one chip per loaded/synced
 * capability, no requirement bodies (that content lives in the Living Specs
 * viewer). A resolved chip posts `openLivingSpec`; the ones in `synced` are
 * marked folded back; with no living-specs data the card renders nothing.
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

    it('renders one compact chip per loaded capability, no folded-back marker when nothing synced', () => {
        const c = renderCard(baseState({ livingSpecs: { loaded: ['checkout', 'cart'], synced: [] } }));
        const chips = Array.from(c.querySelectorAll('.living-specs-chip')).map(n => n.textContent);
        expect(chips).toEqual(['checkout', 'cart']);
        expect(c.querySelectorAll('.living-specs-chip__synced')).toHaveLength(0);
    });

    it('marks synced capabilities as folded back', () => {
        const c = renderCard(baseState({ livingSpecs: { loaded: ['checkout', 'cart'], synced: ['checkout'] } }));
        const items = Array.from(c.querySelectorAll('.living-specs-chips__item'));
        const checkout = items.find(li => li.querySelector('.living-specs-chip')?.textContent === 'checkout');
        const cart = items.find(li => li.querySelector('.living-specs-chip')?.textContent === 'cart');
        expect(checkout?.querySelector('.living-specs-chip__synced')).not.toBeNull();
        expect(cart?.querySelector('.living-specs-chip__synced')).toBeNull();
    });

    it('includes a synced capability that was not loaded this run, de-duplicated', () => {
        const c = renderCard(baseState({ livingSpecs: { loaded: ['cart', 'checkout'], synced: ['checkout'] } }));
        const chips = Array.from(c.querySelectorAll('.living-specs-chip')).map(n => n.textContent);
        expect(chips).toEqual(['cart', 'checkout']);
        expect(c.querySelectorAll('.living-specs-chips__item')).toHaveLength(2);
    });

    it('renders an available capability as a clickable chip that opens the Living Specs viewer', () => {
        const postMessage = jest.fn();
        (globalThis as { vscode?: unknown }).vscode = { postMessage };
        const c = renderCard(
            baseState({
                livingSpecs: {
                    loaded: ['todos'],
                    synced: [],
                    capabilities: [
                        { name: 'todos', available: true, synced: false, specPath: 'capabilities/todos/spec.md' },
                    ],
                },
            }),
        );
        const btn = c.querySelector<HTMLButtonElement>('button.living-specs-chip--link');
        expect(btn).not.toBeNull();
        expect(btn!.textContent).toBe('todos');
        btn!.click();
        expect(postMessage).toHaveBeenCalledWith({
            type: 'openLivingSpec',
            capabilityName: 'todos',
            specPath: 'capabilities/todos/spec.md',
        });
    });

    it('keeps an unresolved historical capability actionable by name', () => {
        const postMessage = jest.fn();
        (globalThis as { vscode?: unknown }).vscode = { postMessage };
        const c = renderCard(
            baseState({
                livingSpecs: {
                    loaded: ['ghost'],
                    synced: [],
                    capabilities: [{ name: 'ghost', available: false, synced: false }],
                },
            }),
        );
        const button = c.querySelector<HTMLButtonElement>('button.living-specs-chip--link');
        expect(button?.textContent).toBe('ghost');
        button!.click();
        expect(postMessage).toHaveBeenCalledWith({
            type: 'openLivingSpec',
            capabilityName: 'ghost',
        });
    });

    it('shows only the capability names — never the full requirement bodies', () => {
        // Regression: even a payload that still carries parsed content must render
        // a compact chip list, not the wall of requirement text.
        const c = renderCard(
            baseState({
                livingSpecs: {
                    loaded: ['viewer-ui', 'spec-viewer'],
                    synced: [],
                    capabilities: [
                        {
                            name: 'viewer-ui',
                            available: true,
                            synced: false,
                            specPath: 'capabilities/viewer-ui/spec.md',
                            purpose: 'PURPOSE PARAGRAPH THAT MUST NOT APPEAR',
                            requirements: [
                                { id: 'FR-001', text: 'FULL REQUIREMENT BODY THAT MUST NOT APPEAR' },
                                { id: 'FR-002', text: 'ANOTHER REQUIREMENT BODY THAT MUST NOT APPEAR' },
                            ],
                        },
                        { name: 'spec-viewer', available: true, synced: false, specPath: 'capabilities/spec-viewer/spec.md' },
                    ],
                } as unknown as ViewerState['livingSpecs'],
            }),
        );
        const chips = Array.from(c.querySelectorAll('.living-specs-chip')).map(n => n.textContent);
        expect(chips).toEqual(['viewer-ui', 'spec-viewer']);
        expect(c.textContent).not.toContain('MUST NOT APPEAR');
        expect(c.textContent).not.toContain('FR-001');
    });

    it('renders nothing when there is no livingSpecs data', () => {
        const c = renderCard(baseState());
        expect(c.querySelector('.activity-card--living-specs')).toBeNull();
        expect(c.textContent).toBe('');
    });
});
