/**
 * @jest-environment jsdom
 *
 * LS·7 — the Living specs run-log card maps `ViewerState.livingSpecs` to a
 * COMPACT list of clickable capability chips: one chip per loaded/synced
 * capability, no requirement bodies (that content lives in the Living Specs
 * viewer). A resolved chip posts `openLivingSpec`; chips sit under "Updated by
 * this run" or "Read for context"; with no living-specs data the card renders nothing.
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
        expect(btn!.textContent).toBe('Todos');
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
        expect(button?.textContent).toBe('Ghost');
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
        expect(chips).toEqual(['Viewer Ui', 'Spec Viewer']);
        expect(c.textContent).not.toContain('MUST NOT APPEAR');
        expect(c.textContent).not.toContain('FR-001');
    });

    it('renders nothing when there is no livingSpecs data', () => {
        const c = renderCard(baseState());
        expect(c.querySelector('.activity-card--living-specs')).toBeNull();
        expect(c.textContent).toBe('');
    });
});
