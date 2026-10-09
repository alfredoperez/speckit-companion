/** Picks a state in a states card: local view state, drawn from the card's own markup. */
export function selectState(button: HTMLElement): void {
    const card = button.closest('.states-card');
    const index = button.dataset.state;
    if (!card || index === undefined) return;
    const sentence = card.querySelector(`.states-list li[data-state="${index}"] .states-sentence`)?.textContent ?? '';
    card.querySelectorAll('.states-state').forEach((el) => {
        const on = el === button;
        el.classList.toggle('is-selected', on);
        el.setAttribute('aria-pressed', String(on));
    });
    const caption = card.querySelector('.states-caption');
    if (caption) caption.textContent = sentence;
}

export function setupStatesSelect(): void {
    document.addEventListener('click', (e) => {
        const button = (e.target as HTMLElement).closest('.states-state') as HTMLElement | null;
        if (button) selectState(button);
    });
}
