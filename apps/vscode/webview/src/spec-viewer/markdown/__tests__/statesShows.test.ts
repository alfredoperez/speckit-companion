/** @jest-environment jsdom */
import { registerBlockRenderer } from '../blockFences';
import { renderScreenBlock } from '../screenCard';
import { renderStatesCard } from '../statesCard';
import { renderMarkdown } from '../renderer';
import { setupStatesSelect } from '../../editor/statesSelect';

const STATES = [
    '```states A review',
    'Draft: Edited. (start)',
    'Sent: Waiting. shows review',
    'Done: Merged. (final)',
    'Draft -> Sent: submit',
    'Sent -> Done: approve',
    'grid:',
    'Draft | Sent | Done',
    '```',
].join('\n');

const SCREEN = [
    '```screen review The review page',
    'title: Review',
    'button: Approve (new) (1)',
    '```',
    '1: **Approve is new.** It closes the review.',
].join('\n');

const mount = (md: string): void => {
    document.body.innerHTML = `<div id="markdown-content">${renderMarkdown(md)}</div>`;
};
const pick = (n: number): void => (document.querySelectorAll('.states-state')[n] as HTMLElement).click();
const row = (): Element | null => document.querySelector('.states-shown');

let installed = false;
beforeEach(() => {
    registerBlockRenderer('states', renderStatesCard);
    registerBlockRenderer('screen', renderScreenBlock);
    if (!installed) { setupStatesSelect(); installed = true; }
});

describe('a state that shows a screen', () => {
    it('draws the screen frame under the caption when picked', () => {
        mount(`${STATES}\n\n${SCREEN}`);
        pick(1);

        expect(row()?.querySelector('.screen-frame')).not.toBeNull();
        expect(row()?.textContent).toContain('Approve');
        expect(row()?.querySelector('.screen-dot')).not.toBeNull();
        expect(row()?.previousElementSibling?.classList.contains('states-caption')).toBe(true);
    });

    it('leaves out the screen header and the notes list', () => {
        mount(`${STATES}\n\n${SCREEN}`);
        pick(1);

        expect(row()?.querySelector('.screen-head, .screen-notes')).toBeNull();
    });

    it('swaps it away when another state is picked', () => {
        mount(`${STATES}\n\n${SCREEN}`);
        pick(1);
        pick(2);

        expect(row()).toBeNull();
    });

    it('shows no row for a state without shows', () => {
        mount(`${STATES}\n\n${SCREEN}`);

        expect(row()).toBeNull();
        pick(0);
        expect(row()).toBeNull();
    });

    it('finds a screen block written after the states block', () => {
        mount(`${STATES}\n\ntext between\n\n${SCREEN}`);
        pick(1);

        expect(row()?.textContent).toContain('Approve');
    });

    it('finds a screen block written before the states block', () => {
        mount(`${SCREEN}\n\n${STATES}`);
        pick(1);

        expect(row()?.textContent).toContain('Approve');
    });

    it('draws nothing when no screen has that name', () => {
        mount(STATES);
        pick(1);

        expect(row()).toBeNull();
    });

    it('draws the start state screen at once when the start state shows one', () => {
        mount(`${STATES.replace('Draft: Edited. (start)', 'Draft: Edited. (start) shows review')}\n\n${SCREEN}`);

        expect(row()?.textContent).toContain('Approve');
    });

    it('keeps markup in a screen part as text', () => {
        mount(`${STATES}\n\n${SCREEN.replace('Approve', '<img src=x onerror=alert(1)>')}`);
        pick(1);

        expect(row()?.querySelector('img')).toBeNull();
        expect(row()?.textContent).toContain('<img');
    });
});
