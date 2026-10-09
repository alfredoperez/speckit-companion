/** Picks a state in a states card: local view state, drawn from the card's own markup. */
export function selectState(button: HTMLElement): void {
    const card = button.closest('.states-card');
    const index = button.dataset.state;
    if (!card || index === undefined) return;
    const item = card.querySelector(`.states-list li[data-state="${index}"]`);
    const name = item?.querySelector('.states-list-name')?.textContent ?? '';
    const sentence = item?.querySelector('.states-sentence')?.textContent ?? '';
    card.querySelectorAll('.states-state').forEach((el) => {
        const on = el === button;
        el.classList.toggle('is-selected', on);
        el.setAttribute('aria-pressed', String(on));
    });
    const caption = card.querySelector('.states-caption');
    if (!caption) return;
    const strong = document.createElement('strong');
    strong.textContent = name;
    caption.replaceChildren(strong, `: ${sentence}`);
    card.querySelector('.states-shown')?.remove();
    const frame = card.querySelector(`.states-screens > [data-state="${index}"]`);
    if (!frame) return;
    const row = document.createElement('div');
    row.className = 'states-shown';
    row.append(...Array.from(frame.cloneNode(true).childNodes));
    caption.after(row);
}

export function setupStatesSelect(): void {
    document.addEventListener('click', (e) => {
        const button = (e.target as HTMLElement).closest('.states-state') as HTMLElement | null;
        if (button) selectState(button);
    });
}
