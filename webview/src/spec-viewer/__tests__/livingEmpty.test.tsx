/**
 * @jest-environment jsdom
 */
import { render } from 'preact';
import { App } from '../App';
import { markdownHtml, navState, viewerState } from '../signals';
import type { NavState } from '../types';

const postMessage = jest.fn();
(globalThis as { vscode?: { postMessage: (m: unknown) => void } }).vscode = { postMessage };

function living(missing: boolean): NavState {
    return {
        coreDocs: [],
        relatedDocs: [],
        currentDoc: 'spec',
        workflowPhase: 'specify',
        taskCompletionPercent: 0,
        isViewingRelatedDoc: false,
        livingMode: true,
        livingMeta: { capabilityName: 'checkout', specPath: 'capabilities/checkout/checkout.spec.md', location: 'centralized', match: ['src/checkout/**'], missing },
    } as NavState;
}

function mount(): HTMLDivElement {
    const container = document.createElement('div');
    document.body.appendChild(container);
    render(<App specStatus="active" />, container);
    return container;
}

afterEach(() => {
    document.body.innerHTML = '';
    navState.value = null;
    viewerState.value = null;
    markdownHtml.value = '';
    postMessage.mockClear();
});

describe('a living capability with no spec file', () => {
    it('shows only the call to adopt it, and adopts its own areas', () => {
        navState.value = living(true);
        const container = mount();
        const cta = container.querySelector<HTMLButtonElement>('.living-empty button');

        expect(cta?.textContent).toContain('Adopt this area');
        cta?.click();
        expect(postMessage).toHaveBeenCalledWith({ type: 'livingAdopt', thisCapability: true });
    });

    it('is not offered for a spec file that exists but is empty', () => {
        navState.value = living(false);
        markdownHtml.value = '';

        expect(mount().querySelector('.living-empty')).toBeNull();
    });
});
