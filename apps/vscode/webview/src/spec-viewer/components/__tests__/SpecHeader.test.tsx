/**
 * @jest-environment jsdom
 */

import { render } from 'preact';
import { SpecHeader } from '../SpecHeader';
import { markdownHtml, navState, viewerState } from '../../signals';
import { mockNavState } from '../__stories__/mockData';

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

describe('the title from the document', () => {
    afterEach(() => { markdownHtml.value = ''; });

    it('leads with the document heading and keeps the folder slug as an id chip', () => {
        navState.value = mockNavState({ specContextName: 'iris-history-monitor-002-new-ui' });
        markdownHtml.value = '<h1 class="lg-sp-title" id="x">Feature Specification: IRIS New UI</h1>';
        const container = renderInto();

        expect(container.querySelector('.spec-header-title')?.textContent).toBe('IRIS New UI');
        expect(container.querySelector('.spec-header-id')?.textContent).toBe('iris-history-monitor-002-new-ui');

        cleanup(container);
    });

    it('drops a short "Spec:" prefix the same way', () => {
        navState.value = mockNavState({ specContextName: 'Demo — Specified' });
        markdownHtml.value = '<h1>Spec: Demo — Dark Mode Toggle</h1>';
        const container = renderInto();

        expect(container.querySelector('.spec-header-title')?.textContent).toBe('Demo — Dark Mode Toggle');

        cleanup(container);
    });

    it('falls back to the folder name when the document has no heading', () => {
        navState.value = mockNavState({ specContextName: 'Some Spec' });
        markdownHtml.value = '<p>no heading</p>';
        const container = renderInto();

        expect(container.querySelector('.spec-header-title')?.textContent).toBe('Some Spec');
        expect(container.querySelector('.spec-header-id')).toBeNull();

        cleanup(container);
    });
});

describe('the title', () => {
    it('renders an authored heading verbatim, preserving deliberate internal casing', () => {
        navState.value = mockNavState({
            specContextName: 'SpecKit Extension Capture',
            titleFromHeading: true,
        });
        const container = renderInto();

        expect(container.querySelector('.spec-header-title')?.textContent)
            .toBe('SpecKit Extension Capture');

        cleanup(container);
    });

    it('renders an acronym-cased feature name unchanged, never re-mangling it', () => {
        navState.value = mockNavState({ specContextName: 'CLI Install Nudge' });
        const container = renderInto();

        expect(container.querySelector('.spec-header-title')?.textContent)
            .toBe('CLI Install Nudge');

        cleanup(container);
    });
});

describe('the assistant a spec was sent to', () => {
    it('shows the name it was given', () => {
        navState.value = mockNavState({ specContextName: 'Payments Core', assistantName: 'Claude Code' });
        const container = renderInto();

        expect(container.querySelector('.spec-header-assistant')?.textContent).toBe('Claude Code');

        cleanup(container);
    });

    it('is absent when none was recorded', () => {
        navState.value = mockNavState({ specContextName: 'Payments Core', branch: 'main' });
        const container = renderInto();

        expect(container.querySelector('.spec-header-assistant')).toBeNull();
        expect(container.querySelector('.spec-header-terminal-btn')).toBeNull();

        cleanup(container);
    });

    it('still renders when the name is the only header fact', () => {
        navState.value = mockNavState({
            specContextName: 'Payments Core',
            badgeText: null,
            branch: null,
            createdDate: null,
            assistantName: 'Codex CLI',
        });
        const container = renderInto();

        expect(container.querySelector('.spec-header-assistant')).not.toBeNull();

        cleanup(container);
    });
});

describe('the Show terminal button', () => {
    it('asks the extension to reveal the terminal', () => {
        const postMessage = jest.fn();
        (globalThis as unknown as { vscode: unknown }).vscode = { postMessage };
        navState.value = mockNavState({ specContextName: 'Payments Core', hasTerminal: true });
        const container = renderInto();

        container.querySelector<HTMLButtonElement>('.spec-header-terminal-btn')?.click();

        expect(postMessage).toHaveBeenCalledWith({ type: 'showTerminal' });

        cleanup(container);
    });

    it('is absent without a live terminal', () => {
        navState.value = mockNavState({ specContextName: 'Payments Core', assistantName: 'Claude Code' });
        const container = renderInto();

        expect(container.querySelector('.spec-header-terminal-btn')).toBeNull();

        cleanup(container);
    });
});

describe('the badge of a bug page', () => {
    it.each([
        ['review', 'WAITING FOR YOUR REVIEW', 'spec-badge--report-review'],
        ['to-fix', 'TO FIX', 'spec-badge--report-to-fix'],
    ] as const)('takes the %s tone', (badgeTone, badgeText, tone) => {
        navState.value = mockNavState({ badgeText, specStatus: 'active', report: { kind: 'bug', badgeTone } });
        const container = renderInto();
        const badge = container.querySelector('.spec-badge');
        expect(badge?.textContent).toBe(badgeText);
        expect(badge?.classList.contains(tone)).toBe(true);
        expect(badge?.classList.contains('spec-badge--active')).toBe(false);
        cleanup(container);
    });
});

describe('the header title', () => {
    afterEach(() => { markdownHtml.value = ''; });

    it("keeps the spec's own title on every tab, with the id chip beside it", () => {
        for (const html of ['<h1>Feature Specification: Starred todos</h1>', '<blockquote>See the spec</blockquote>', '<h1>Tasks</h1>']) {
            navState.value = mockNavState({ specTitle: 'Starred todos', specContextName: '001 Starred Todos Filter', titleFromHeading: false });
            markdownHtml.value = html;
            const container = renderInto();

            expect(container.querySelector('.spec-header-title')?.textContent).toBe('Starred todos');
            expect(container.textContent).toContain('001 Starred Todos Filter');

            cleanup(container);
        }
    });

    it('drops the id chip when it only differs from the title by case', () => {
        navState.value = mockNavState({ specTitle: 'Starred todos and filter', specContextName: 'Starred Todos And Filter', titleFromHeading: false });
        const container = renderInto();

        expect(container.textContent?.match(/starred todos and filter/gi)).toHaveLength(1);

        cleanup(container);
    });
});
