/**
 * @jest-environment jsdom
 */

import { navState } from '../signals';
import { idChip, refAnchor } from 'speckit-viewer/core/markdown/ledger/primitives';
import { hideBackPill, hideRefCard, setupLedgerRefs } from '../ledgerRefs';
import type { NavState } from '../types';

const posted: unknown[] = [];
(globalThis as any).vscode = { postMessage: (m: unknown) => posted.push(m), getState: () => undefined, setState: () => {} };

function mount(): void {
    document.body.innerHTML = `<div id="markdown-content">
        <p ${refAnchor('FR-001', { family: 'req', label: 'Requirement' })}>The system MUST show the status in the header at all times.</p>
        <p ${refAnchor('T003', { family: 'task' })}><input type="checkbox" checked> Wire the badge ${idChip('FR-001')}</p>
        <p id="far">${idChip('R12', { doc: 'research' })}</p>
    </div>`;
    Element.prototype.scrollIntoView = jest.fn();
}

const chip = () => document.querySelector<HTMLElement>('#ref-t003 a.lg-chip')!;

beforeAll(() => {
    window.matchMedia = ((query: string) => ({ matches: false, media: query })) as unknown as typeof window.matchMedia;
    setupLedgerRefs();
});

beforeEach(() => {
    jest.useFakeTimers();
    posted.length = 0;
    mount();
    navState.value = { currentDoc: 'tasks', coreDocs: [{ type: 'tasks', exists: true, filePath: '/s/tasks.md' }], relatedDocs: [{ type: 'research', exists: true, filePath: '/s/research.md' }] } as unknown as NavState;
});

afterEach(() => {
    hideRefCard();
    hideBackPill();
    jest.useRealTimers();
});

describe('RefHoverCard', () => {
    it('opens after 300ms of hover with the target eyebrow and text', () => {
        chip().dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        jest.advanceTimersByTime(299);
        expect(document.querySelector('.lg-refcard')).toBeNull();
        jest.advanceTimersByTime(2);

        const card = document.querySelector('.lg-refcard')!;
        expect(card.getAttribute('role')).toBe('tooltip');
        expect(card.textContent).toContain('Requirement · FR-001');
        expect(card.textContent).toContain('MUST show the status');
        expect(chip().getAttribute('aria-describedby')).toBe('lg-refcard');
    });

    it('opens on keyboard focus and closes on Escape', () => {
        chip().dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
        jest.advanceTimersByTime(300);
        expect(document.querySelector('.lg-refcard')).not.toBeNull();

        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

        expect(document.querySelector('.lg-refcard')).toBeNull();
    });

    it('shows the target status read from its checkbox', () => {
        const holder = document.createElement('div');
        holder.innerHTML = idChip('T003');
        document.querySelector('#ref-fr-001')!.appendChild(holder);

        holder.querySelector('a')!.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        jest.advanceTimersByTime(300);

        expect(document.querySelector('.lg-refcard-status')?.textContent).toBe('Done');
    });
});

describe('jump and Back pill', () => {
    it('scrolls to the target, flashes it and offers Back to the origin row', () => {
        chip().click();

        expect(document.getElementById('ref-fr-001')!.classList.contains('lg-flash')).toBe(true);
        expect(document.querySelector('.lg-backpill')?.textContent).toBe('Back to T003');
    });

    it('Alt+Left returns to the origin and removes the pill', () => {
        chip().click();
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', altKey: true }));

        expect(document.getElementById('ref-t003')!.classList.contains('lg-flash')).toBe(true);
        expect(document.querySelector('.lg-backpill')).toBeNull();
    });

    it('switches document for a cross-document chip', () => {
        document.querySelector<HTMLElement>('#far a')!.click();

        expect(posted).toContainEqual({ type: 'switchDocument', documentType: 'research' });
    });
});
