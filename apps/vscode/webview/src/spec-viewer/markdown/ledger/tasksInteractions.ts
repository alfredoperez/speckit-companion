/**
 * Webview-local task controls: story filter, Hide done and long-title expand.
 * The state lives here and is never sent to the extension or written to disk.
 */

interface Filters {
    story: string;
    hideDone: boolean;
}

export function applyTaskFilters(root: ParentNode, filters: Filters): void {
    const active = !!filters.story || filters.hideDone;
    root.querySelectorAll<HTMLElement>('li.task-item').forEach((row) => {
        const hide = (!!filters.story && row.dataset.story !== filters.story) || (filters.hideDone && row.dataset.state === 'done');
        row.classList.toggle('lg-hidden', hide);
    });
    root.querySelectorAll<HTMLElement>('.lg-wave, .lg-phase').forEach((box) => {
        const empty = active && !box.querySelector('li.task-item:not(.lg-hidden)') && !!box.querySelector('li.task-item');
        box.classList.toggle('lg-hidden', empty);
    });
    root.querySelectorAll<HTMLElement>('.lg-filter').forEach((btn) => {
        btn.setAttribute('aria-pressed', String((btn.dataset.lgStory ?? '') === filters.story));
    });
    root.querySelectorAll<HTMLElement>('.lg-toggle').forEach((btn) => btn.setAttribute('aria-checked', String(filters.hideDone)));
}

export function setupLedgerTasks(container: HTMLElement = document.getElementById('markdown-content') ?? document.body): void {
    if (container.dataset.lgTasks) return;
    container.dataset.lgTasks = '1';
    const filters: Filters = { story: '', hideDone: false };
    const apply = (): void => applyTaskFilters(container, filters);

    container.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const filter = target.closest<HTMLElement>('.lg-filter');
        if (filter) {
            filters.story = filter.dataset.lgStory ?? '';
            apply();
            return;
        }
        if (target.closest('.lg-toggle')) {
            filters.hideDone = !filters.hideDone;
            apply();
            return;
        }
        const title = target.closest<HTMLElement>('.lg-task-title');
        if (title && !target.closest('a, button') && (title.classList.contains('is-expanded') || title.scrollHeight > title.clientHeight + 1)) {
            title.classList.toggle('is-expanded');
        }
    });

    new MutationObserver(() => {
        if (filters.story || filters.hideDone) apply();
    }).observe(container, { childList: true });
}
