/**
 * @jest-environment jsdom
 */

import { render } from 'preact';
import { LivingOverview } from '../LivingOverview';
import { navState, viewerMode } from '../../signals';
import { mockNavState } from '../__stories__/mockData';

const postMessage = jest.fn();
(globalThis as unknown as { vscode: unknown }).vscode = { postMessage };

function renderInto(): HTMLDivElement {
    const container = document.createElement('div');
    document.body.appendChild(container);
    render(<LivingOverview />, container);
    return container;
}

const overview = {
    purpose: 'Keeps the *todo* list in order.\n\nAnd nothing else.',
    requirements: [
        { heading: 'Keeps order', adopted: true },
        { heading: 'Already confirmed', adopted: false },
    ],
};

beforeEach(() => {
    postMessage.mockClear();
    viewerMode.value = null;
    navState.value = mockNavState({
        livingMode: true,
        currentDoc: 'spec',
        livingOverview: overview,
        livingMeta: {
            capabilityName: 'todos',
            specPath: 'src/todos.spec.md',
            location: 'colocated',
            match: ['src/todos/**'],
            coverage: { covered: 1, total: 2 },
            drifted: true,
        },
    });
});

describe('the living Overview', () => {
    it('shows purpose, covers, health and one row per requirement, in that order', () => {
        const container = renderInto();
        const kickers = Array.from(container.querySelectorAll('.dossier-kicker')).map(el => el.textContent);
        expect(kickers).toEqual(['Purpose', 'Covers', 'Health', 'Requirements']);
        expect(container.querySelectorAll('.living-overview__purpose')).toHaveLength(2);
        expect(container.querySelector('.living-overview__purpose em')?.textContent).toBe('todo');
        expect(container.querySelector('.spec-header-glob')?.textContent).toBe('src/todos/**');
        expect(container.querySelector('.living-overview__health')?.textContent).toContain('1 of 2 requirements have a mapped test');
        expect(container.querySelector('.living-overview__drift')).not.toBeNull();
        expect(container.querySelectorAll('.living-overview__req')).toHaveLength(2);
        render(null, container);
    });

    it('counts the requirements still adopted and offers Approve spec beside the count', () => {
        const container = renderInto();
        const adopted = container.querySelector('.living-overview__adopted');
        expect(adopted?.textContent).toContain('1 of 2');
        expect(adopted?.querySelector('.spec-header-approve')).not.toBeNull();
        expect(container.querySelectorAll('.living-overview__pip')).toHaveLength(1);

        adopted?.querySelector<HTMLButtonElement>('.spec-header-approve')?.click();
        expect(postMessage).toHaveBeenCalledWith({ type: 'approveSpec', documentType: 'spec' });
        render(null, container);
    });

    it('a requirement row switches to the Spec tab and tells the extension', () => {
        const container = renderInto();
        container.querySelectorAll<HTMLButtonElement>('.living-overview__req')[1].click();
        expect(viewerMode.value).toBe('document');
        expect(postMessage).toHaveBeenCalledWith({ type: 'documentChosen' });
        render(null, container);
    });

    it('from another tier, opens the spec on that requirement', () => {
        navState.value = { ...navState.value!, currentDoc: 'rules' };
        const container = renderInto();
        container.querySelector<HTMLButtonElement>('.living-overview__req')?.click();
        expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'openLivingSpec', requirement: 'Keeps order' }));
        render(null, container);
    });
});
