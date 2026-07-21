import type { Meta, StoryObj } from '@storybook/preact';
import { useEffect } from 'preact/hooks';
import {
    renderMarkdown,
    setHasSpecContext,
    setLivingMode,
    setLivingCoverage,
    setTaskSummaries,
} from './index';
import { applyHighlighting } from '../highlighting';

/**
 * Shared living-mode host: renders a markdown fixture through the real
 * `renderMarkdown` pipeline with `setLivingMode(true)` so the living
 * preprocessors run and the shipped `_living.css` applies. Story cases below
 * pass different fixtures (and optional per-requirement coverage) to exercise
 * every enumerated state from the render contract (FR-023 / SC-008).
 */
interface LivingDocProps {
    md: string;
    coverage?: Record<string, string>;
}

function LivingDoc({ md, coverage }: LivingDocProps) {
    setHasSpecContext(false);
    setLivingMode(true);
    setLivingCoverage(coverage ?? null);
    setTaskSummaries(null);
    const html = renderMarkdown(md);
    useEffect(() => {
        const id = requestAnimationFrame(() => applyHighlighting());
        return () => cancelAnimationFrame(id);
    }, [html]);
    // These are global renderer flags — reset on unmount so navigating to
    // another markdown story doesn't inherit this story's living mode.
    useEffect(() => () => {
        setLivingMode(false);
        setLivingCoverage(null);
    }, []);
    return (
        <div
            id="markdown-content"
            style="max-width: 820px;"
            dangerouslySetInnerHTML={{ __html: html }}
        />
    );
}

const meta: Meta<typeof LivingDoc> = {
    title: 'Viewer/Markdown Rendering/Living/Components',
    component: LivingDoc,
};
export default meta;
type Story = StoryObj<typeof LivingDoc>;

const DRAFT_BANNER = '> [DRAFT] Surface-first draft from existing code — review before trusting.';

// ── User Story 1 — draft notice + purpose callout ──────────────────────

export const Draft: Story = {
    args: {
        md: [
            '# Payments — Living Spec',
            '',
            DRAFT_BANNER,
            '',
            '## Purpose',
            '',
            'Charge a customer once, reconcile every attempt, and never double-charge on a retry. Without this the retry path silently bills twice.',
        ].join('\n'),
    },
};

export const NonDraft: Story = {
    args: {
        md: [
            '# Payments — Living Spec',
            '',
            '## Purpose',
            '',
            'A verified record: no draft banner, so no trust-boundary notice renders.',
        ].join('\n'),
    },
};

export const MissingPurpose: Story = {
    args: {
        md: [
            '# Payments — Living Spec',
            '',
            DRAFT_BANNER,
            '',
            '## Requirements',
            '',
            '### A rule with no purpose section above it',
            '',
            'No purpose callout should appear, and no placeholder text is invented.',
        ].join('\n'),
    },
};

export const VeryLongPurpose: Story = {
    args: {
        md: [
            '# Payments — Living Spec',
            '',
            DRAFT_BANNER,
            '',
            '## Purpose',
            '',
            'This capability owns the entire money-movement path, and its purpose paragraph is deliberately long to prove the callout wraps cleanly at narrow widths without clipping, without a horizontal scrollbar, and without the label detaching from the body. It reconciles authorizations against captures, captures against settlements, and settlements against payouts, so that every cent that leaves an account can be traced to exactly one intent, one attempt, and one ledger entry, even when the network retries mid-flight.',
        ].join('\n'),
    },
};

export const FallbackToPlainMarkdown: Story = {
    args: {
        md: [
            '# Living spec with only unrecognized content',
            '',
            'When a region matches no living component, it falls through to the base',
            'markdown renderer losslessly — no line is dropped, the page still renders.',
            '',
            '- an ordinary bullet',
            '- another ordinary bullet',
        ].join('\n'),
    },
};

// ── User Story 2 — requirement cards + scenarios ───────────────────────

const REQ_MIX = [
    '## Requirements',
    '',
    '### Charges are idempotent across retries',
    '',
    'A repeated charge request with the same idempotency key MUST settle at most once.',
    '',
    '#### Scenario: a retry arrives after a success',
    '- **WHEN** a charge succeeds and the client retries with the same key',
    '- **THEN** the original result is returned',
    '- **AND** no second authorization is created',
    '',
    '### Refunds never exceed the captured amount [inferred]',
    '',
    'A refund MUST be rejected when it would push total refunds above what was captured.',
    '',
    '#### Scenario: an over-refund is attempted',
    '- **WHEN** the requested refund exceeds the remaining captured balance',
    '- **THEN** the refund is rejected',
    '',
    '### Settlement reconciles every attempt',
    '',
    'Each authorization MUST map to exactly one settlement line.',
].join('\n');

export const RequirementsObservedAndInferred: Story = {
    args: { md: REQ_MIX },
};

export const RequirementsWithCoverage: Story = {
    args: {
        md: REQ_MIX,
        coverage: {
            // covered, uncovered (a determinable no-tests tier — a label, never a
            // bare 0), and unknown-coverage (omitted → no badge) in one view.
            'Charges are idempotent across retries': 'covered · 4/4',
            'Refunds never exceed the captured amount': 'uncovered',
            // "Settlement reconciles every attempt" intentionally omitted → unknown coverage, no badge
        },
    },
};

export const RequirementNoScenarios: Story = {
    args: {
        md: [
            '## Requirements',
            '',
            '### A rule with no scenarios',
            '',
            'The card renders cleanly with no empty scenario container.',
        ].join('\n'),
    },
};

export const RequirementManyScenarios: Story = {
    args: {
        md: [
            '## Requirements',
            '',
            '### A heavily specified rule',
            '',
            'Body prose describing the rule.',
            '',
            '#### Scenario: first case',
            '- **WHEN** condition one holds',
            '- **THEN** outcome one follows',
            '',
            '#### Scenario: second case',
            '- **WHEN** condition two holds',
            '- **THEN** outcome two follows',
            '- **AND** a secondary outcome also follows',
            '',
            '#### Scenario: third case',
            '- **WHEN** condition three holds',
            '- **THEN** outcome three follows',
        ].join('\n'),
    },
};

export const RequirementLongTitle: Story = {
    args: {
        md: [
            '## Requirements',
            '',
            '### A deliberately very long requirement title that must wrap across multiple lines at narrow widths without clipping, without a horizontal scrollbar, and without detaching its confidence badge [inferred]',
            '',
            'The card and its badges stay laid out cleanly even when the heading is long.',
        ].join('\n'),
    },
};

// ── User Story 3 — uncovered evidence ──────────────────────────────────

export const UncoveredNothing: Story = {
    args: {
        md: '## Uncovered\n\n_None — every file in the area was read._\n',
    },
};

export const UncoveredOneFile: Story = {
    args: {
        md: [
            '## Uncovered',
            '',
            'Read the area at surface level; one file was not read in full.',
            '',
            '- **Read at surface level only**',
            '  - `src/legacy/monolith.ts`',
        ].join('\n'),
    },
};

export const UncoveredManyReasons: Story = {
    args: {
        md: [
            '## Uncovered',
            '',
            'Read most of the capability; several files across three reasons were not read in full.',
            '',
            '- **Too large to read fully**',
            '  - `src/big/module-a.ts`',
            '  - `src/big/module-b.ts`',
            '- **Unreadable (binary)**',
            '  - `assets/blob.bin`',
            '- **Read at surface level only**',
            '  - `src/legacy/adapter.ts`',
            '  - `src/legacy/shim.ts`',
        ].join('\n'),
    },
};

export const UncoveredOneReasonLongList: Story = {
    args: {
        md: [
            '## Uncovered',
            '',
            'One reason, a long file list — the disclosure stays closed until asked for.',
            '',
            '- **Too large to read fully**',
            '  - `src/big/module-a.ts`',
            '  - `src/big/module-b.ts`',
            '  - `src/big/module-c.ts`',
            '  - `src/big/module-d.ts`',
            '  - `src/big/module-e.ts`',
            '  - `src/big/module-f.ts`',
            '  - `src/big/module-g.ts`',
            '  - `src/big/module-h.ts`',
        ].join('\n'),
    },
};
