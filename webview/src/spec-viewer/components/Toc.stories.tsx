import type { Meta, StoryObj } from '@storybook/preact';
import { useEffect, useRef } from 'preact/hooks';
import { buildToc } from '../toc';

interface Heading {
    level: 'h2' | 'h3';
    id: string;
    text: string;
}

interface TocHarnessProps {
    headings: Heading[];
    /** Pin the content region's width — below --toc-min-width the outline
     *  becomes the compact disclosure above the document. */
    width?: number;
}

function renderHeadingsHtml(headings: Heading[]): string {
    if (headings.length === 0) {
        return '<p style="color: var(--text-muted)">Empty document — TOC hides itself when no headings exist.</p>';
    }
    return headings
        .map(h => {
            const tag = h.level;
            return `<${tag} id="${h.id}" style="margin-top: ${h.level === 'h2' ? 24 : 16}px">${h.text}</${tag}>` +
                `<p style="color: var(--text-muted); margin-top: 8px;">Sample body so the scroll container has content beneath each heading.</p>`;
        })
        .join('');
}

/**
 * Harness that renders the same DOM shape the spec viewer mounts (a
 * .content-area scroll container holding #markdown-content + aside.spec-toc),
 * then invokes the imperative buildToc() builder after mount. Headings are
 * built via innerHTML so the story matches how the real viewer renders
 * markdown (also avoids JSX-tag collisions with the `h` jsx-factory).
 */
function TocHarness({ headings, width }: TocHarnessProps) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const markdownRef = useRef<HTMLDivElement>(null);
    const tocRef = useRef<HTMLElement>(null);

    useEffect(() => {
        buildToc(scrollRef.current, markdownRef.current, tocRef.current);
    }, [headings]);

    return (
        <div
            ref={scrollRef}
            class="content-area"
            id="content-area"
            style={{
                height: '560px',
                overflowY: 'auto',
                padding: 'var(--content-padding)',
                width: width ? `${width}px` : undefined,
                border: width ? '1px solid var(--border)' : undefined,
            }}
        >
            <div
                ref={markdownRef}
                id="markdown-content"
                dangerouslySetInnerHTML={{ __html: renderHeadingsHtml(headings) }}
            />
            <aside ref={tocRef} class="spec-toc" id="spec-toc" aria-label="Table of contents" />
        </div>
    );
}

// The long headings a real tasks.md produces, used by the stories below.
const LONG_HEADINGS: Heading[] = [
    { level: 'h2', id: 'setup', text: 'Setup' },
    { level: 'h2', id: 'foundational', text: 'Foundational (blocks all stories)' },
    { level: 'h2', id: 'us1', text: 'User Story 1 — Read any spec without losing content' },
    { level: 'h3', id: 'impl-1', text: 'Implementation' },
    { level: 'h2', id: 'us2', text: 'User Story 2 — The viewer still reacts to the run lifecycle' },
    { level: 'h3', id: 'impl-2', text: 'Implementation' },
    { level: 'h2', id: 'us3', text: "User Story 3 — The run's story is the front page" },
    { level: 'h3', id: 'impl-3', text: 'Implementation' },
    { level: 'h2', id: 'us4', text: 'User Story 4 — Custom workflows drive the shell' },
    { level: 'h3', id: 'impl-4', text: 'Implementation' },
    { level: 'h2', id: 'us5', text: 'User Story 5 — The reading layout holds at any width' },
    { level: 'h3', id: 'impl-5', text: 'Implementation' },
    { level: 'h2', id: 'polish', text: 'Polish' },
    { level: 'h2', id: 'review-fixes', text: 'Review fixes + Context-First revision (post-review)' },
    { level: 'h2', id: 'deps', text: 'Dependencies & Execution Order' },
];

const meta: Meta<typeof TocHarness> = {
    title: 'Viewer/Toc',
    component: TocHarness,
};
export default meta;

type Story = StoryObj<typeof TocHarness>;

// plan.md shape: pure h2 outline, no toggle should appear.
export const PlanLikeH2Only: Story = {
    render: () => (
        <TocHarness
            headings={[
                { level: 'h2', id: 'summary', text: 'Summary' },
                { level: 'h2', id: 'technical-context', text: 'Technical Context' },
                { level: 'h2', id: 'constitution-check', text: 'Constitution Check' },
                { level: 'h2', id: 'project-structure', text: 'Project Structure' },
                { level: 'h2', id: 'documentation', text: 'Documentation (this feature)' },
                { level: 'h2', id: 'source-code', text: 'Source Code (repository root)' },
                { level: 'h2', id: 'complexity-tracking', text: 'Complexity Tracking' },
            ]}
        />
    ),
};

// tasks.md shape: h2 phases plus h3 subsections under user-story phases.
// Default render is h2-only; the "Show subsections" toggle reveals h3s.
// Verifies: `Format:` and `Path Conventions` h2s render in the body but are
// FILTERED OUT of the TOC (instructional-only); `(Priority: P*)` suffixes in
// phase titles are STRIPPED from TOC entries while staying in the body heading.
export const TasksLikeWithSubsections: Story = {
    render: () => (
        <TocHarness
            headings={[
                { level: 'h2', id: 'format', text: 'Format: [ID] [P?] [Story] Description' },
                { level: 'h2', id: 'path-conventions', text: 'Path Conventions' },
                { level: 'h2', id: 'phase-1', text: 'Phase 1: Setup (Shared Infrastructure)' },
                { level: 'h2', id: 'phase-2', text: 'Phase 2: Foundational (Blocking Prerequisites)' },
                { level: 'h2', id: 'phase-3', text: 'Phase 3: User Story 1 — Developer Onboarding via Architecture Docs (Priority: P1)' },
                { level: 'h3', id: 'tests-us1', text: 'Tests for US1' },
                { level: 'h3', id: 'impl-us1', text: 'Implementation for US1' },
                { level: 'h2', id: 'phase-4', text: 'Phase 4: User Story 2 — Developer Understanding Feature Docs (Priority: P2)' },
                { level: 'h3', id: 'tests-us2', text: 'Tests for US2' },
                { level: 'h3', id: 'impl-us2', text: 'Implementation for US2' },
                { level: 'h2', id: 'phase-5', text: 'Phase 5: User Story 3 — Contributor Updating CLAUDE.md (Priority: P3)' },
                { level: 'h3', id: 'tests-us3', text: 'Tests for US3' },
                { level: 'h3', id: 'impl-us3', text: 'Implementation for US3' },
            ]}
        />
    ),
};

// The stress case, wide: long wrapping headings in the right-hand column.
// Entries clamp to two lines (full text on hover). Hit "Subsections +" to
// review the expanded state — h3s hang off a guide rule, and each repeated
// "Implementation" carries its parent section in its accessible name.
export const LongHeadingsStressTest: Story = {
    name: 'Long headings (readability stress test)',
    render: () => <TocHarness headings={LONG_HEADINGS} />,
};

// Below --toc-min-width (1040px) the outline does not simply vanish: it becomes
// an "On this page" disclosure ABOVE the document, so the reading column keeps
// its full width and the outline is still one click away.
export const CompactDisclosure: Story = {
    name: 'Compact disclosure (narrow / split pane)',
    render: () => <TocHarness headings={LONG_HEADINGS} width={720} />,
};

// Empty doc: the aside hides itself entirely (.spec-toc--empty).
export const EmptyDoc: Story = {
    render: () => <TocHarness headings={[]} />,
};

// Verifies the in-content metadata-hiding rules added in _content.css for
// SpecKit-created specs. The decorator sets body[data-has-spec-context="true"]
// for the duration of the story and the harness renders fake .spec-meta and
// .spec-input blocks that the CSS should hide.
function MetadataHidingHarness() {
    const html = `
        <div class="spec-meta">
            <span class="meta-item"><span class="meta-branch">049-fix-badge-status-display</span></span>
            <span class="meta-item"><span class="meta-label">Date:</span> 2026-04-05</span>
        </div>
        <div class="spec-input">
            <span class="meta-label">Input:</span>
            <em>User description: "Rethink how we show the badge status because when tasks step finishes, it shows 'implement' in the badge instead of reflecting that the current step (tasks) is completed."</em>
        </div>
        <h2 id="summary">Summary</h2>
        <p style="color: var(--text-muted); margin-top: 8px;">
            Below the meta blocks (which should be hidden when spec-context is
            on), the regular markdown content keeps rendering as usual.
        </p>
    `;
    const scrollRef = useRef<HTMLDivElement>(null);
    const markdownRef = useRef<HTMLDivElement>(null);
    const tocRef = useRef<HTMLElement>(null);

    useEffect(() => {
        buildToc(scrollRef.current, markdownRef.current, tocRef.current);
    }, []);

    return (
        <div
            ref={scrollRef}
            class="content-area"
            style={{
                display: 'flex',
                flexDirection: 'row',
                gap: 'var(--space-6)',
                alignItems: 'flex-start',
                height: '480px',
                overflowY: 'auto',
                padding: 'var(--content-padding)',
            }}
        >
            <div
                ref={markdownRef}
                id="markdown-content"
                style={{ flex: 1, maxWidth: '72ch' }}
                dangerouslySetInnerHTML={{ __html: html }}
            />
            <aside ref={tocRef} class="spec-toc" id="spec-toc" aria-label="Table of contents" />
        </div>
    );
}

export const WithSpecContext: Story = {
    decorators: [
        (Story) => {
            document.body.dataset.hasSpecContext = 'true';
            return <Story />;
        },
    ],
    render: () => <MetadataHidingHarness />,
};

export const WithoutSpecContext: Story = {
    decorators: [
        (Story) => {
            document.body.dataset.hasSpecContext = 'false';
            return <Story />;
        },
    ],
    render: () => <MetadataHidingHarness />,
};
