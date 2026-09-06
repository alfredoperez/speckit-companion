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

/**
 * The requirement card a heading sits inside, or null.
 *
 * A living spec's requirements are its `h3`s, and the card around each one
 * already carries its coverage and the number of files its marker names. The
 * outline reads them off that card rather than parsing the markdown a second
 * time — a second parse is exactly how a row and its card come to disagree.
 */
function requirementCard(heading: HTMLElement): HTMLElement | null {
    return heading.closest<HTMLElement>('.living-req-card');
}

/**
 * Coverage and file-count marks for one requirement row.
 *
 * Both are drawn, and both are hidden from assistive tech, because the row's
 * one accessible name says them in words instead. A dot carrying only a `title`
 * is not reliably announced, and a bare `2` beside a heading says nothing.
 * Returns the phrases the caller folds into that name.
 */
function requirementMarks(card: HTMLElement, a: HTMLAnchorElement): string[] {
    const said: string[] = [];

    // The heading moves into its own span so it can ellipsize beside the marks;
    // as a bare text node in a flex row it would push them off the edge.
    const label = document.createElement('span');
    label.className = 'spec-toc-text';
    label.textContent = a.textContent;
    a.textContent = '';

    const coverage = card.dataset.reqCoverage;
    const dot = document.createElement('span');
    // Unknown coverage reads as unknown, never as zero: a missing count and a
    // genuine zero mean opposite things to a reader.
    dot.className = coverage ? 'spec-toc-cov' : 'spec-toc-cov spec-toc-cov--unknown';
    dot.setAttribute('aria-hidden', 'true');
    a.append(dot, label);
    said.push(coverage ? `covered ${coverage}` : 'coverage unknown');

    const files = card.dataset.reqPatterns;
    if (files) {
        const count = document.createElement('span');
        count.className = 'spec-toc-patterns';
        count.setAttribute('aria-hidden', 'true');
        count.textContent = files;
        a.appendChild(count);
        // Patterns, not files: `src/alpha/**` is one entry claiming a whole
        // directory, and calling that "1 file" is a number the reader can check
        // and find wrong.
        said.push(`${files} ${files === '1' ? 'path pattern' : 'path patterns'}`);
    }
    return said;
}


function prefersReducedMotion(): boolean {
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

export function buildToc(
    scrollRoot: HTMLElement | null,
    markdownRoot: HTMLElement | null,
    tocRoot: HTMLElement | null
): void {
    if (!scrollRoot || !markdownRoot || !tocRoot) return;

    teardown(tocRoot);

    const allHeadings = Array.from(
        markdownRoot.querySelectorAll<HTMLElement>('h2[id], h3[id]')
    ).filter(h => {
        const text = (h.textContent ?? '').trim();
        return !TOC_SKIP_PATTERNS.some(re => re.test(text));
    });
    const hasH3 = allHeadings.some(h => h.tagName.toLowerCase() === 'h3');

    // A living spec's requirements ARE its `h3`s, so hiding them by default
    // would leave the outline listing three section headings for a document the
    // reader navigates by requirement.
    const living = allHeadings.some(h => requirementCard(h) !== null);
    const headings = showSubsections || living
        ? allHeadings
        : allHeadings.filter(h => h.tagName.toLowerCase() === 'h2');

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

    if (hasH3 && !living) {
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

    for (const heading of headings) {
        const id = heading.id;
        if (!id) continue;
        const level = heading.tagName.toLowerCase(); // 'h2' | 'h3'

        const li = document.createElement('li');
        const a = document.createElement('a');
        a.className = `spec-toc-link spec-toc-link--${level}`;
        a.href = `#${id}`;
        const text = (heading.textContent ?? '').replace(PRIORITY_SUFFIX, '').trim();
        a.textContent = text;
        // The entry clamps to two lines, so the full heading lives in the tooltip.
        a.title = text;

        const card = requirementCard(heading);
        // The marks are drawn but hidden from assistive tech; what they mean is
        // said once, here, in the row's own accessible name.
        const said = card ? requirementMarks(card, a) : [];
        if (card) a.classList.add('spec-toc-link--requirement');

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
