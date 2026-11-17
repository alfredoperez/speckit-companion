/**
 * @jest-environment jsdom
 */

import { buildToc } from '../toc';

let wake: () => void = () => undefined;
class FakeIO {
    constructor(cb: () => void) { wake = cb; }
    observe(): void { /* noop */ }
    unobserve(): void { /* noop */ }
    disconnect(): void { /* noop */ }
}
class NoopRO {
    observe(): void { /* noop */ }
    disconnect(): void { /* noop */ }
}
beforeAll(() => {
    (globalThis as Record<string, unknown>).IntersectionObserver = FakeIO;
    (globalThis as Record<string, unknown>).ResizeObserver = NoopRO;
});

const rect = (top: number, height = 0) => ({ top, height, bottom: top + height, left: 0, right: 0, width: 0, x: 0, y: top, toJSON: () => ({}) }) as DOMRect;

describe('outline active section', () => {
    it('marks the section in view, not the next heading further down', () => {
        document.body.innerHTML = '<div id="scroll"><div id="md"><h2 id="clarifications">Clarifications</h2><h2 id="scenarios">User Scenarios</h2></div></div><aside id="toc"></aside>';
        const scroll = document.getElementById('scroll') as HTMLElement;
        const md = document.getElementById('md') as HTMLElement;
        const toc = document.getElementById('toc') as HTMLElement;
        Object.defineProperty(scroll, 'clientWidth', { value: 1200 });
        scroll.getBoundingClientRect = () => rect(0, 1000);
        md.querySelector<HTMLElement>('#clarifications')!.getBoundingClientRect = () => rect(20);
        md.querySelector<HTMLElement>('#scenarios')!.getBoundingClientRect = () => rect(900);
        buildToc(scroll, md, toc);

        wake();

        expect(toc.querySelector('[aria-current="location"]')?.textContent).toBe('Clarifications');
    });
});
