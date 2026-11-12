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
 * Below that threshold the outline does not vanish — it becomes a compact
 * "On this page" disclosure above the document (same links, same observers),
 * because a reading column has no room to give a permanent 240px column.
 *
 * Defaults to h2-only rendering; users can toggle h3 subsections back in via
 * the "Subsections" button in the TOC header. The choice is module-scoped
 * so it persists across doc switches within a single viewer session.
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

let showSubsections = false;

// Headings that are instructional/reference, not navigable sections.
// They stay in the rendered markdown but get filtered out of the outline so
// the TOC reads as "places to jump to," not "every h2 in the file."
const TOC_SKIP_PATTERNS: RegExp[] = [
    /^\s*Format\s*:/i,
    /^\s*Path Conventions\s*$/i,
];

// User-story phase headings carry "(Priority: P*)" suffixes in the doc to
// surface priority next to the heading. The user-story card already shows
// priority prominently, so the TOC strips the suffix to keep entries scannable.
const PRIORITY_SUFFIX = /\s*\(Priority:\s*P\d+\)\s*$/i;

export function prefersReducedMotion(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function readTocMinWidth(): number {
    const raw = getComputedStyle(document.documentElement)
        .getPropertyValue('--toc-min-width')
        .trim();
    const parsed = parseFloat(raw);
    // Must match --toc-min-width in _toc.css: a higher fallback would force the
    // compact outline on a laptop-width pane the CSS considers wide enough.
    return Number.isFinite(parsed) ? parsed : 920;
}

function isNarrow(scrollRoot: HTMLElement): boolean {
    return scrollRoot.clientWidth < readTocMinWidth();
}

function teardown(tocRoot: HTMLElement): void {
    const prev = observers.get(tocRoot);
    if (!prev) return;
    prev.io.disconnect();
    prev.ro.disconnect();
    prev.clickCleanup();
    observers.delete(tocRoot);
}

interface OutlineEntry {
    el: HTMLElement;
    level: 2 | 3;
    title: string;
}

const slugOf = (text: string): string =>
    text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'section';

/**
 * Every outline target in document order: real h2/h3 headings plus any element
 * that stands in for one with `data-toc` (title = the attribute, or its own text
 * when empty; level from `data-toc-level`, default 2). Ledger components replace
 * a heading with an eyebrow, so without this the outline loses those sections.
 */
export function collectOutline(root: HTMLElement): OutlineEntry[] {
    const taken = new Set<string>();
    root.querySelectorAll<HTMLElement>('[id]').forEach(e => taken.add(e.id));
    const out: OutlineEntry[] = [];
    for (const el of Array.from(root.querySelectorAll<HTMLElement>('h2[id], h3[id], [data-toc]'))) {
        const marked = el.hasAttribute('data-toc');
        const raw = marked ? (el.dataset.toc || el.textContent) : el.textContent;
        const title = (raw ?? '').replace(/\s+/g, ' ').trim();
        if (!title || TOC_SKIP_PATTERNS.some(re => re.test(title))) continue;
        let level: 2 | 3;
        if (marked) {
            level = el.dataset.tocLevel === '3' ? 3 : 2;
            if (!el.id) {
                let id = `toc-${slugOf(title)}`;
                for (let n = 2; taken.has(id); n++) id = `toc-${slugOf(title)}-${n}`;
                el.id = id;
                taken.add(id);
            }
        } else {
            level = el.tagName.toLowerCase() === 'h3' ? 3 : 2;
        }
        out.push({ el, level, title });
    }
    // A section component and the heading it grew from would list twice.
    const marked = new Set(out.filter(e => e.el.hasAttribute('data-toc')).map(e => e.title.toLowerCase()));
    return out.filter(e => e.el.hasAttribute('data-toc') || !marked.has(e.title.toLowerCase()));
}

export function buildToc(
    scrollRoot: HTMLElement | null,
    markdownRoot: HTMLElement | null,
    tocRoot: HTMLElement | null
): void {
    if (!scrollRoot || !markdownRoot || !tocRoot) return;

    teardown(tocRoot);

    const allHeadings = collectOutline(markdownRoot);
    const hasH3 = allHeadings.some(h => h.level === 3);

    const headings = showSubsections
        ? allHeadings
        : allHeadings.filter(h => h.level === 2);

    if (headings.length === 0) {
        tocRoot.classList.add('spec-toc--empty');
        tocRoot.innerHTML = '';
        return;
    }

    tocRoot.classList.remove('spec-toc--empty');

    // Header chrome: label + optional show-subsections toggle. Toggle only
    // renders when the doc actually has h3 entries — no point offering it
    // for plan.md where every heading is already an h2.
    const header = document.createElement('div');
    header.className = 'spec-toc-header';
    const label = document.createElement('span');
    label.className = 'spec-toc-label';
    label.textContent = 'On this page';
    header.appendChild(label);

    if (hasH3) {
        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'spec-toc-toggle';
        // A bare +/− was ambiguous ("add what?"). It says what it toggles.
        toggle.textContent = showSubsections ? 'Subsections −' : 'Subsections +';
        const tooltip = showSubsections ? 'Hide subsections' : 'Show subsections';
        toggle.title = tooltip;
        toggle.setAttribute('aria-label', tooltip);
        toggle.setAttribute('aria-pressed', showSubsections ? 'true' : 'false');
        toggle.addEventListener('click', () => {
            showSubsections = !showSubsections;
            buildToc(scrollRoot, markdownRoot, tocRoot);
            // Restore focus to the new toggle after the rebuild swapped DOM.
            const next = tocRoot.querySelector<HTMLButtonElement>('.spec-toc-toggle');
            if (next) next.focus();
        });
        header.appendChild(toggle);
    }

    const list = document.createElement('ul');
    list.className = 'spec-toc-list';

    const linkByTargetId = new Map<string, HTMLAnchorElement>();
    let parentSection = '';

    for (const entry of headings) {
        const heading = entry.el;
        const id = heading.id;
        if (!id) continue;
        const level = `h${entry.level}`;

        const li = document.createElement('li');
        const a = document.createElement('a');
        a.className = `spec-toc-link spec-toc-link--${level}`;
        a.href = `#${id}`;
        const text = entry.title.replace(PRIORITY_SUFFIX, '').trim();
        a.textContent = text;
        // The entry clamps to two lines, so the full heading lives in the tooltip.
        a.title = text;

        const said: string[] = [];

        if (level === 'h2') {
            parentSection = text;
        } else if (parentSection) {
            // A tasks.md has five headings called "Implementation". Out of
            // context they are indistinguishable, so the accessible name says
            // which section each one belongs to.
            said.unshift(parentSection);
        }
        if (said.length) a.setAttribute('aria-label', `${text} — ${said.join(', ')}`);
        a.dataset.target = id;
        li.appendChild(a);
        list.appendChild(li);
        linkByTargetId.set(id, a);
    }

    tocRoot.innerHTML = '';
    const narrow = isNarrow(scrollRoot);
    tocRoot.classList.toggle('spec-toc--compact', narrow);
    if (narrow) {
        // No room for a column: the same outline becomes a disclosure that sits
        // above the document. Same links, same observers — only the shell differs.
        const details = document.createElement('details');
        details.className = 'spec-toc-disclosure';
        const summary = document.createElement('summary');
        summary.className = 'spec-toc-summary';
        summary.textContent = 'On this page';
        details.appendChild(summary);
        details.appendChild(header);
        details.appendChild(list);
        tocRoot.appendChild(details);
    } else {
        tocRoot.appendChild(header);
        tocRoot.appendChild(list);
    }

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

    // IntersectionObserver — wakes on each heading crossing the activation line;
    // the active entry is the last heading at or above that line, else the first.
    const updateActive = () => {
        const rootRect = scrollRoot.getBoundingClientRect();
        const line = rootRect.top + rootRect.height * 0.3;
        let best: HTMLElement | null = headings[0]?.el ?? null;
        for (const { el: heading } of headings) {
            const rect = heading.getBoundingClientRect();
            if (rect.height === 0 && rect.width === 0) continue;
            if (rect.top <= line) best = heading;
            else break;
        }
        if (!best) return;
        for (const link of linkByTargetId.values()) {
            link.removeAttribute('aria-current');
        }
        linkByTargetId.get(best.id)?.setAttribute('aria-current', 'location');
    };
    const io = new IntersectionObserver(updateActive, {
        root: scrollRoot,
        rootMargin: '0px 0px -70% 0px',
        threshold: 0
    });
    for (const { el } of headings) io.observe(el);

    // ResizeObserver — the column and the disclosure are different DOM, so a
    // crossing of the threshold rebuilds rather than merely restyling. Rebuild
    // ONLY on a crossing: rebuilding on every resize tick would thrash (and the
    // rebuild itself resizes the container).
    let wasNarrow = narrow;
    scrollRoot.classList.toggle('content-area--narrow', narrow);
    const applyWidthClass = () => {
        const nowNarrow = isNarrow(scrollRoot);
        scrollRoot.classList.toggle('content-area--narrow', nowNarrow);
        if (nowNarrow !== wasNarrow) {
            wasNarrow = nowNarrow;
            buildToc(scrollRoot, markdownRoot, tocRoot);
        }
    };
    const ro = new ResizeObserver(applyWidthClass);
    ro.observe(scrollRoot);

    observers.set(tocRoot, {
        io,
        ro,
        clickCleanup: () => tocRoot.removeEventListener('click', onClick)
    });
}
