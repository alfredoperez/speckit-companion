/**
 * SpecKit Companion - Table of Contents builder
 *
 * Scans rendered headings inside #markdown-content, populates an aside.spec-toc
 * with anchor links, and wires up:
 *   - smooth-scroll click handlers (honoring prefers-reduced-motion)
 *   - IntersectionObserver to track the active heading (aria-current="location")
 *   - ResizeObserver on the scroll container to toggle .content-area--narrow
 *     when its inline size drops below --toc-min-width.
 *
 * buildToc is idempotent — it tears down prior observers before rebuilding,
 * so it can be called on every doc switch (spec → plan → tasks → related).
 */

interface ObserverPair {
    io: IntersectionObserver;
    ro: ResizeObserver;
    clickCleanup: () => void;
}

const observers = new WeakMap<HTMLElement, ObserverPair>();

function prefersReducedMotion(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function readTocMinWidth(): number {
    const raw = getComputedStyle(document.documentElement)
        .getPropertyValue('--toc-min-width')
        .trim();
    const parsed = parseFloat(raw);
    return Number.isFinite(parsed) ? parsed : 780;
}

function teardown(tocRoot: HTMLElement): void {
    const prev = observers.get(tocRoot);
    if (!prev) return;
    prev.io.disconnect();
    prev.ro.disconnect();
    prev.clickCleanup();
    observers.delete(tocRoot);
}

export function buildToc(
    scrollRoot: HTMLElement | null,
    markdownRoot: HTMLElement | null,
    tocRoot: HTMLElement | null
): void {
    if (!scrollRoot || !markdownRoot || !tocRoot) return;

    teardown(tocRoot);

    const headings = Array.from(
        markdownRoot.querySelectorAll<HTMLElement>('h2[id], h3[id]')
    );

    if (headings.length === 0) {
        tocRoot.classList.add('spec-toc--empty');
        tocRoot.innerHTML = '';
        return;
    }

    tocRoot.classList.remove('spec-toc--empty');

    const list = document.createElement('ul');
    list.className = 'spec-toc-list';

    const linkByTargetId = new Map<string, HTMLAnchorElement>();

    for (const heading of headings) {
        const id = heading.id;
        if (!id) continue;
        const level = heading.tagName.toLowerCase(); // 'h2' | 'h3'

        const li = document.createElement('li');
        const a = document.createElement('a');
        a.className = `spec-toc-link spec-toc-link--${level}`;
        a.href = `#${id}`;
        a.textContent = heading.textContent ?? '';
        a.dataset.target = id;
        li.appendChild(a);
        list.appendChild(li);
        linkByTargetId.set(id, a);
    }

    tocRoot.innerHTML = '';
    tocRoot.appendChild(list);

    // Click handler — smooth scroll, honor prefers-reduced-motion, set active.
    const onClick = (event: Event) => {
        const target = event.target as HTMLElement;
        const link = target.closest('a.spec-toc-link') as HTMLAnchorElement | null;
        if (!link) return;
        const targetId = link.dataset.target;
        if (!targetId) return;
        const targetEl = markdownRoot.querySelector<HTMLElement>(`#${CSS.escape(targetId)}`);
        if (!targetEl) return;
        event.preventDefault();
        targetEl.scrollIntoView({
            behavior: prefersReducedMotion() ? 'auto' : 'smooth',
            block: 'start'
        });
        for (const other of linkByTargetId.values()) {
            other.removeAttribute('aria-current');
        }
        link.setAttribute('aria-current', 'location');
    };
    tocRoot.addEventListener('click', onClick);

    // IntersectionObserver — tracks topmost intersecting heading.
    const visible = new Set<string>();
    const io = new IntersectionObserver(
        entries => {
            for (const entry of entries) {
                const id = (entry.target as HTMLElement).id;
                if (!id) continue;
                if (entry.isIntersecting) visible.add(id);
                else visible.delete(id);
            }
            if (visible.size === 0) return;
            // Pick the heading nearest the top of the scroll viewport.
            let best: HTMLElement | null = null;
            let bestTop = Number.POSITIVE_INFINITY;
            const rootTop = scrollRoot.getBoundingClientRect().top;
            for (const id of visible) {
                const el = markdownRoot.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
                if (!el) continue;
                const top = el.getBoundingClientRect().top - rootTop;
                if (top < bestTop) {
                    bestTop = top;
                    best = el;
                }
            }
            if (!best) return;
            for (const link of linkByTargetId.values()) {
                link.removeAttribute('aria-current');
            }
            const activeLink = linkByTargetId.get(best.id);
            if (activeLink) activeLink.setAttribute('aria-current', 'location');
        },
        {
            root: scrollRoot,
            rootMargin: '-10% 0px -70% 0px',
            threshold: 0
        }
    );
    for (const heading of headings) io.observe(heading);

    // ResizeObserver — toggle narrow class on the scroll container.
    const applyWidthClass = () => {
        const threshold = readTocMinWidth();
        scrollRoot.classList.toggle(
            'content-area--narrow',
            scrollRoot.clientWidth < threshold
        );
    };
    applyWidthClass();
    const ro = new ResizeObserver(applyWidthClass);
    ro.observe(scrollRoot);

    observers.set(tocRoot, {
        io,
        ro,
        clickCleanup: () => tocRoot.removeEventListener('click', onClick)
    });
}
