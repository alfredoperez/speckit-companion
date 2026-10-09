/** @jest-environment jsdom */
import { selectState, setupStatesSelect } from '../statesSelect';

const card = (): string => `<div class="states-card">
    <button type="button" class="states-state is-selected" data-state="0" aria-pressed="true">Draft</button>
    <button type="button" class="states-state" data-state="1" aria-pressed="false">Sent</button>
    <div class="states-caption"><strong>Draft</strong>: Edited.</div>
    <ul class="states-list"><li data-state="0"><span class="states-list-name">Draft</span> <span class="states-sentence">Edited.</span></li><li data-state="1"><span class="states-list-name">Sent</span> <span class="states-sentence">Waiting.</span></li></ul>
</div>`;

const button = (n: number, root: ParentNode = document): HTMLElement =>
    root.querySelectorAll('.states-state')[n] as HTMLElement;
const caption = (root: ParentNode = document): string => root.querySelector('.states-caption')?.textContent ?? '';

let installed = false;
beforeEach(() => {
    document.body.innerHTML = `<div id="markdown-content">${card()}</div>`;
    if (!installed) { setupStatesSelect(); installed = true; }
});

describe('picking a state', () => {
    it('selects the clicked state and shows its sentence', () => {
        button(1).click();

        expect(button(1).classList.contains('is-selected')).toBe(true);
        expect(button(1).getAttribute('aria-pressed')).toBe('true');
        expect(caption()).toBe('Sent: Waiting.');
    });

    it('names the picked state in bold before its sentence', () => {
        button(1).click();

        expect(document.querySelector('.states-caption strong')?.textContent).toBe('Sent');
    });

    it('leaves only one state selected', () => {
        button(1).click();

        expect(button(0).classList.contains('is-selected')).toBe(false);
        expect(button(0).getAttribute('aria-pressed')).toBe('false');
        expect(document.querySelectorAll('.is-selected')).toHaveLength(1);
    });

    it('keeps working after the card is drawn again', () => {
        document.querySelector('#markdown-content')!.innerHTML = card();
        button(1).click();

        expect(caption()).toBe('Sent: Waiting.');
    });

    it('only touches the card it was clicked in', () => {
        document.body.innerHTML = `<div id="markdown-content">${card()}${card()}</div>`;
        const cards = document.querySelectorAll('.states-card');
        button(1, cards[1]).click();

        expect(caption(cards[0])).toBe('Draft: Edited.');
        expect(caption(cards[1])).toBe('Sent: Waiting.');
    });

    it('ignores a click outside a state', () => {
        (document.querySelector('.states-caption') as HTMLElement).click();

        expect(caption()).toBe('Draft: Edited.');
    });

    it('can be called directly', () => {
        selectState(button(1));

        expect(caption()).toBe('Sent: Waiting.');
    });
});
