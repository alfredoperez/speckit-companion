/**
 * @jest-environment jsdom
 */

import { render } from 'preact';
import { SpecHeader } from '../SpecHeader';
import { navState, viewerState } from '../../signals';
import { mockNavState } from '../__stories__/mockData';
import type { LivingHeaderMeta } from '../../types';

function renderInto(): HTMLDivElement {
    const container = document.createElement('div');
    document.body.appendChild(container);
    render(<SpecHeader />, container);
    return container;
}

function cleanup(container: HTMLDivElement) {
    render(null, container);
    container.remove();
}

function livingMeta(overrides: Partial<LivingHeaderMeta> = {}): LivingHeaderMeta {
    return {
        capabilityName: 'speckit-extension-capture',
        specPath: 'capabilities/speckit-extension-capture/spec.md',
        location: 'centralized',
        match: ['speckit-extension/**'],
        ...overrides,
    };
}

beforeEach(() => {
    viewerState.value = null;
});

describe('the status badge tooltip', () => {
    it('says nothing when there is no created date to add', () => {
        navState.value = mockNavState({
            badgeText: 'DRAFT',
            createdDate: null,
            branch: null,
            specContextName: 'Payments Core',
        });
        const container = renderInto();
        const badge = container.querySelector('.spec-badge');

        expect(badge?.textContent).toBe('DRAFT');
        expect(badge?.hasAttribute('title')).toBe(false);

        cleanup(container);
    });

    it('still names the created date when there is one', () => {
        navState.value = mockNavState({
            badgeText: 'COMPLETED',
            createdDate: 'Apr 4, 2026',
        });
        const container = renderInto();

        expect(container.querySelector('.spec-badge')?.getAttribute('title'))
            .toBe('COMPLETED · Apr 4, 2026');

        cleanup(container);
    });
});

describe('the title', () => {
    it('keeps the author capitalization when it came from the document heading', () => {
        navState.value = mockNavState({
            specContextName: 'SpecKit Extension Capture',
            titleFromHeading: true,
        });
        const container = renderInto();

        expect(container.querySelector('.spec-header-title')?.className)
            .toContain('spec-header-title--authored');

        cleanup(container);
    });

    it('leaves the slug capitalization on for a derived name', () => {
        navState.value = mockNavState({ specContextName: 'my feature' });
        const container = renderInto();

        expect(container.querySelector('.spec-header-title')?.className)
            .not.toContain('spec-header-title--authored');

        cleanup(container);
    });
});

describe('the living-spec facts row', () => {
    it('is absent for a feature spec', () => {
        navState.value = mockNavState({});
        const container = renderInto();

        expect(container.querySelector('.spec-header-living')).toBeNull();

        cleanup(container);
    });

    it('shows counts, coverage and drift when they are known', () => {
        navState.value = mockNavState({
            livingMode: true,
            badgeText: 'LIVING',
            branch: null,
            createdDate: null,
            livingMeta: livingMeta({
                requirements: 12,
                scenarios: 34,
                coverage: { covered: 8, total: 12 },
                drifted: true,
            }),
        });
        const container = renderInto();
        const facts = container.querySelector('.spec-header-living')?.textContent ?? '';

        expect(facts).toContain('12 requirements');
        expect(facts).toContain('34 scenarios');
        expect(facts).toContain('8/12 covered');
        expect(facts).toContain('drift');

        cleanup(container);
    });

    it('singularizes a count of one', () => {
        navState.value = mockNavState({
            livingMode: true,
            livingMeta: livingMeta({ requirements: 1, scenarios: 1 }),
        });
        const container = renderInto();
        const facts = container.querySelector('.spec-header-living')?.textContent ?? '';

        expect(facts).toContain('1 requirement');
        expect(facts).not.toContain('1 requirements');
        expect(facts).toContain('1 scenario');
        expect(facts).not.toContain('1 scenarios');

        cleanup(container);
    });

    it('omits a fact that could not be determined rather than showing a zero', () => {
        navState.value = mockNavState({
            livingMode: true,
            livingMeta: livingMeta(),
        });
        const container = renderInto();
        const facts = container.querySelector('.spec-header-living')?.textContent ?? '';

        expect(facts).not.toContain('covered');
        expect(facts).not.toContain('requirement');
        expect(facts).not.toContain('scenario');
        expect(container.querySelector('.spec-header-fact--drift')).toBeNull();

        cleanup(container);
    });

    it('shows no drift marker when the capability has been checked and has not drifted', () => {
        navState.value = mockNavState({
            livingMode: true,
            livingMeta: livingMeta({ drifted: false }),
        });
        const container = renderInto();

        expect(container.querySelector('.spec-header-fact--drift')).toBeNull();

        cleanup(container);
    });
});

describe('the claimed-files row', () => {
    it('lists what the capability covers', () => {
        navState.value = mockNavState({
            livingMode: true,
            livingMeta: livingMeta({ match: ['speckit-extension/**', 'src/features/specs/**'] }),
        });
        const container = renderInto();
        const globs = Array.from(container.querySelectorAll('.spec-header-glob'))
            .map(el => el.textContent);

        expect(globs).toEqual(['speckit-extension/**', 'src/features/specs/**']);

        cleanup(container);
    });

    it('caps the list and keeps the rest reachable', () => {
        navState.value = mockNavState({
            livingMode: true,
            livingMeta: livingMeta({ match: ['a/**', 'b/**', 'c/**', 'd/**', 'e/**'] }),
        });
        const container = renderInto();
        const chips = Array.from(container.querySelectorAll('.spec-header-glob'))
            .map(el => el.textContent);

        expect(chips).toEqual(['a/**', 'b/**', 'c/**', '+2 more']);
        expect(container.querySelector('.spec-header-glob--more')?.getAttribute('title'))
            .toBe('d/**\ne/**');

        cleanup(container);
    });

    it('is absent when the capability claims nothing', () => {
        navState.value = mockNavState({
            livingMode: true,
            livingMeta: livingMeta({ match: [] }),
        });
        const container = renderInto();

        expect(container.querySelector('.spec-header-covers')).toBeNull();

        cleanup(container);
    });

    it('renders a claimed pattern as text, never as markup', () => {
        navState.value = mockNavState({
            livingMode: true,
            livingMeta: livingMeta({ match: ['<img src=x onerror=alert(1)>/**'] }),
        });
        const container = renderInto();

        expect(container.querySelector('.spec-header-glob')?.textContent)
            .toBe('<img src=x onerror=alert(1)>/**');
        expect(container.querySelector('img')).toBeNull();

        cleanup(container);
    });
});

describe('the spec location', () => {
    it('shows the path and explains where it lives', () => {
        navState.value = mockNavState({
            livingMode: true,
            livingMeta: livingMeta(),
        });
        const container = renderInto();
        const location = container.querySelector('.spec-header-path');

        expect(location?.textContent).toBe('capabilities/speckit-extension-capture/spec.md');
        expect(location?.getAttribute('title')).toBe('Lives in the central specs folder');

        cleanup(container);
    });

    it('explains a spec that sits next to the code', () => {
        navState.value = mockNavState({
            livingMode: true,
            livingMeta: livingMeta({
                location: 'colocated',
                specPath: 'src/store/todos.spec.md',
            }),
        });
        const container = renderInto();

        expect(container.querySelector('.spec-header-path')?.getAttribute('title'))
            .toBe('Lives next to the code it describes');

        cleanup(container);
    });
});
