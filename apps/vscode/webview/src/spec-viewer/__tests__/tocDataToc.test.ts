/**
 * @jest-environment jsdom
 */

import { buildToc } from '../toc';

class NoopIO {
    observe(): void { /* noop */ }
    disconnect(): void { /* noop */ }
}
beforeAll(() => {
    (globalThis as Record<string, unknown>).IntersectionObserver = NoopIO;
    (globalThis as Record<string, unknown>).ResizeObserver = NoopIO;
});

function outline(html: string): string[] {
    document.body.innerHTML = `<div id="scroll"><div id="md">${html}</div></div><aside id="toc"></aside>`;
    const scroll = document.getElementById('scroll') as HTMLElement;
    Object.defineProperty(scroll, 'clientWidth', { value: 1200 });
    buildToc(scroll, document.getElementById('md'), document.getElementById('toc'));
    return Array.from(document.querySelectorAll('.spec-toc-link')).map(a => a.textContent ?? '');
}

describe('outline entries marked with data-toc', () => {
    it('lists them in document order beside real headings', () => {
        const entries = outline(
            '<div data-toc="User stories"></div><h2 id="a">Scenarios</h2><div data-toc="Requirements" id="reqs"></div>',
        );

        expect(entries).toEqual(['User stories', 'Scenarios', 'Requirements']);
    });

    it('gives a marked element without an id one the link can target', () => {
        outline('<div data-toc="Edge cases"></div><div data-toc="Edge cases"></div>');

        const targets = Array.from(document.querySelectorAll('.spec-toc-link')).map(a => (a as HTMLElement).dataset.target);
        expect(targets).toEqual(['toc-edge-cases', 'toc-edge-cases-2']);
        expect(document.getElementById('toc-edge-cases')).not.toBeNull();
    });

    it('reads an empty attribute as the element text', () => {
        const entries = outline('<span data-toc="">Phase 1: Setup</span>');

        expect(entries).toEqual(['Phase 1: Setup']);
    });

    it('lists a section once when its heading survives beside the component', () => {
        const entries = outline('<div data-toc="Requirements"></div><h2 id="requirements">Requirements</h2><h2 id="x">Other</h2>');

        expect(entries).toEqual(['Requirements', 'Other']);
    });

    it('keeps a level-3 entry behind the subsections toggle', () => {
        const entries = outline('<div data-toc="Decisions"></div><div data-toc="R1 Pick" data-toc-level="3"></div>');

        expect(entries).toEqual(['Decisions']);
    });
});
