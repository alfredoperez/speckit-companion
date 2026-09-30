/**
 * @jest-environment jsdom
 */

import { renderMarkdown } from '../markdown/renderer';
import { navState } from '../signals';
import { applyPendingFragment, resolveDocumentLink, setupDocumentLinkClickHandler } from '../documentLinks';
import type { NavState, SpecDocument } from '../types';

const DIR = '/ws/specs/001-demo';

function doc(type: string, relPath: string, exists = true): SpecDocument {
    return {
        type, label: type, fileName: relPath.split('/').pop()!, filePath: `${DIR}/${relPath}`,
        exists, isCore: !relPath.includes('/'), category: relPath.includes('/') ? 'related' : 'core',
    } as SpecDocument;
}

function nav(currentDoc: string, overrides: Partial<NavState> = {}): NavState {
    return {
        coreDocs: [doc('spec', 'spec.md'), doc('plan', 'plan.md'), doc('tasks', 'tasks.md')],
        relatedDocs: [doc('requirements', 'checklists/requirements.md')],
        currentDoc,
        ...overrides,
    } as NavState;
}

describe('resolveDocumentLink', () => {
    it('maps a relative link to a core document to that document', () => {
        const link = resolveDocumentLink('./tasks.md', nav('plan'));
        expect(link).toMatchObject({ kind: 'document', core: true, fragment: '' });
        expect((link as { doc: SpecDocument }).doc.type).toBe('tasks');
    });

    it('carries the fragment of a link to a heading in another document', () => {
        const link = resolveDocumentLink('./spec.md#approach', nav('plan'));
        expect(link).toMatchObject({ kind: 'document', fragment: 'approach' });
    });

    it('resolves a parent-relative link from a document in a subfolder', () => {
        const link = resolveDocumentLink('../spec.md', nav('requirements'));
        expect((link as { doc: SpecDocument }).doc.type).toBe('spec');
    });

    it('marks a related document so it opens through switchDocument', () => {
        const link = resolveDocumentLink('./checklists/requirements.md', nav('spec'));
        expect(link).toMatchObject({ kind: 'document', core: false });
    });

    it('treats a bare fragment as a scroll inside the current document', () => {
        expect(resolveDocumentLink('#goals', nav('spec'))).toEqual({ kind: 'fragment', fragment: 'goals' });
    });

    it('leaves http, https and mailto links to the host', () => {
        for (const href of ['https://example.com/a.md', 'http://x.dev', 'mailto:a@b.co']) {
            expect(resolveDocumentLink(href, nav('spec'))).toEqual({ kind: 'external' });
        }
    });

    it('sends a relative link to a file that is not a spec document to the file opener as the path it resolves to', () => {
        expect(resolveDocumentLink('../../src/app.ts', nav('spec'))).toEqual({ kind: 'file', filename: '/ws/src/app.ts' });
    });

    it('does not match a document whose file is missing', () => {
        const ns = nav('plan', { relatedDocs: [doc('research', 'research.md', false)] });
        expect(resolveDocumentLink('./research.md', ns)).toEqual({ kind: 'file', filename: `${DIR}/research.md` });
    });
});

describe('document link clicks in the rendered viewer', () => {
    const postMessage = jest.fn();
    let installed = false;

    function mount(markdown: string): void {
        document.body.innerHTML = `<div id="markdown-content">${renderMarkdown(markdown)}</div>`;
        Element.prototype.scrollIntoView = jest.fn();
    }

    function click(selector: string): boolean {
        const el = document.querySelector(selector)!;
        return el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    }

    beforeAll(() => {
        (globalThis as unknown as { vscode: unknown }).vscode = { postMessage };
        window.matchMedia = (() => ({ matches: false })) as unknown as typeof window.matchMedia;
        // jsdom ships no CSS.escape.
        (globalThis as unknown as { CSS: unknown }).CSS = { escape: (s: string) => s.replace(/[^\w-]/g, '\\$&') };
    });

    beforeEach(() => {
        postMessage.mockReset();
        if (!installed) {
            setupDocumentLinkClickHandler();
            installed = true;
        }
    });

    it('switches to the plan-pointed tasks document instead of dropping the click', () => {
        navState.value = nav('plan');
        mount('See [tasks.md](./tasks.md) for the work.');
        const notPrevented = click('a');
        expect(notPrevented).toBe(false);
        expect(postMessage).toHaveBeenCalledWith({ type: 'stepperClick', phase: 'tasks' });
    });

    it('scrolls to the heading once the linked document has rendered', () => {
        navState.value = nav('plan');
        mount('[Approach](./spec.md#approach)');
        click('a');
        expect(postMessage).toHaveBeenCalledWith({ type: 'stepperClick', phase: 'spec' });

        navState.value = nav('spec');
        mount('## Approach\n\nDo it.');
        applyPendingFragment();
        expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1);
        expect(document.querySelector('#approach')).not.toBeNull();
    });

    it('keeps the wanted heading for its own document when another document renders first', () => {
        navState.value = nav('plan');
        mount('[Approach](./spec.md#approach)');
        click('a');

        mount('## Approach\n\nDo it.');
        Element.prototype.scrollIntoView = jest.fn();
        applyPendingFragment();
        expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();

        navState.value = nav('spec');
        applyPendingFragment();
        expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1);
    });

    it('opens a related document through switchDocument', () => {
        navState.value = nav('spec');
        mount('[reqs](./checklists/requirements.md)');
        click('a');
        expect(postMessage).toHaveBeenCalledWith({ type: 'switchDocument', documentType: 'requirements' });
    });

    it('scrolls within the current document for a fragment link without messaging the host', () => {
        navState.value = nav('spec');
        mount('[Jump](#approach)\n\n## Approach\n\nDo it.');
        click('a');
        expect(postMessage).not.toHaveBeenCalled();
        expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1);
    });

    it('scrolls instead of reloading when a link names the document already open', () => {
        navState.value = nav('spec');
        mount('[Approach](./spec.md#approach)\n\n## Approach\n\nDo it.');
        click('a');
        expect(postMessage).not.toHaveBeenCalled();
        expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1);
    });

    it('leaves an https link alone so the host opens it', () => {
        navState.value = nav('spec');
        mount('[site](https://example.com)');
        expect(click('a')).toBe(true);
        expect(postMessage).not.toHaveBeenCalled();
    });
});
