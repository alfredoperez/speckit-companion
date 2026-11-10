import type { Meta, StoryObj } from '@storybook/preact';
import { MarkdownDoc } from './storyDoc';

/** Individual Spec-page renderers, each shown in isolation (real excerpts). */
const meta: Meta<typeof MarkdownDoc> = {
    title: 'VS Code Extension/Spec Viewer/Markdown Rendering/Spec/Components',
    component: MarkdownDoc,
};
export default meta;
type Story = StoryObj<typeof MarkdownDoc>;

export const Requirements: Story = {
    args: {
        md: [
            '## Functional Requirements',
            '',
            '- **FR-001** When the banner has enough room, the system MUST keep the side-by-side layout.',
            '- **FR-002** When narrower than the threshold, it MUST stack the actions below the text.',
            '- **FR-003** The body paragraph MUST always wrap and MUST NOT be truncated.',
            '- **NFR-001** The layout change MUST add no measurable render cost.',
            '',
            '## Success Criteria',
            '',
            '- **SC-001** No line of the heading or body contains only one or two words from cramping.',
            '- **SC-002** The actions appear below the text at narrow widths.',
        ].join('\n'),
    },
};

export const UserStoriesAndScenarios: Story = {
    args: {
        md: [
            '### User Story 1 - Trustworthy single spec status (Priority: P1)',
            '',
            'As a spec author, when I open a spec I see one overall status that is the same across the sidebar, header, and stepper.',
            '',
            '**Why this priority**: The per-step status in the header is the primary source of confusion.',
            '',
            '**Independent Test**: Open any spec; the surfaces must agree, and switching tabs must not change it.',
            '',
            '**Acceptance Scenarios**:',
            '',
            '1. **Given** a spec whose current step is plan and is in progress, **When** I switch tabs, **Then** the header still reads "Planning".',
            '2. **Given** a spec with status completed, **When** I view any step, **Then** every surface reads "Completed" and nothing pulses.',
        ].join('\n'),
    },
};

export const KeyEntities: Story = {
    args: {
        md: [
            '### Key Entities',
            '',
            '- **SpecContext** (`.spec-context.json`) — the per-spec lifecycle record; status and history must stay byte-identical.',
            '- **StepHistoryEntry** — per-step record of `startedAt`, `completedAt`, and an optional substeps list.',
            '- **Transition** — an append-only event: `step`, `substep`, `from`, `by`, `at`.',
        ].join('\n'),
    },
};

export const Callouts: Story = {
    args: {
        md: [
            '**Purpose**: Validate the responsive banner behaves at every panel width.',
            '',
            '**Warning**: Container queries require the webview runtime to support `container-type`.',
            '',
            '**Note**: The threshold (~420px) is a tunable default, not a hard requirement.',
        ].join('\n'),
    },
};

const LEDGER_SPEC = [
    '# Feature Specification: New Monitor Interface',
    '',
    '**Feature Branch**: `002-new-ui`',
    '**Created**: 2026-10-09',
    '**Status**: Clarified',
    '**Input**: User description: "uma interface web nova, com o novo design"',
    '',
    '## User Scenarios & Testing *(mandatory)*',
    '',
    '### User Story 1 - See the health of the instance at a glance (Priority: P1)',
    '',
    'An operator opens the monitor and sees every overview metric with value, unit and status.',
    '',
    '**Why this priority**: The Overview is the first screen people open.',
    '',
    '**Independent Test**: Turn the interface on and compare every figure with the API (FR-003).',
    '',
    '**Acceptance Scenarios**:',
    '',
    '1. **Given** the interface is on, **When** the Overview opens, **Then** all metrics are shown (FR-003).',
    '2. **Given** a metric is a warning, **When** it is shown, **Then** status is text as well as color.',
    '3. **Given** the data source stops answering, **When** a refresh fails, **Then** the last figures stay visible.',
    '',
    '### User Story 2 - Sign in once (Priority: P2)',
    '',
    'A user signs in once and uses every screen.',
    '',
    '### Edge Cases',
    '',
    '- A period crosses a daylight-saving change: times stay in order and none is shown twice',
    '- The user opens two screens in two browser tabs: both work with the same sign-in',
    '',
    '## Requirements *(mandatory)*',
    '',
    '### Functional Requirements',
    '',
    '- **FR-003**: The Overview MUST show all overview metrics with value, unit and status.',
    '- **FR-012**: The user MUST be able to export the data as a CSV file.',
    '',
    '### Key Entities *(include if feature involves data)*',
    '',
    '- **Overview metric**: a named figure with value, unit and status.',
    '',
    '## Success Criteria *(mandatory)*',
    '',
    '### Measurable Outcomes',
    '',
    '- **SC-001**: Each operator spots every non-ok metric within 5 seconds (US1, FR-003).',
    '- **SC-008**: ~~Four of five participants rate it clearer~~ (withdrawn)',
    '',
    '## Assumptions',
    '',
    '- The Overview refreshes every 10 seconds by default; the user can pause it.',
    '',
    '## Clarifications',
    '',
    '### Session 2026-10-09',
    '',
    '- Q: What happens to the old pages? -> A: They are marked obsolete (FR-012).',
    '- Q: Should the CSV export include hidden columns?',
].join('\n');

/** The Ledger spec page: header, story index, story cards, requirements, criteria, edge cases, assumptions, entities, clarifications, verbatim. */
export const LedgerSpecWide: Story = {
    name: 'Ledger spec (wide)',
    args: { md: LEDGER_SPEC },
};

/** The same spec in a 420px column: ids and status move above the text. */
export const LedgerSpecNarrow: Story = {
    name: 'Ledger spec (420px)',
    args: { md: LEDGER_SPEC },
    decorators: [(StoryFn) => <div style="max-width: 420px;"><StoryFn /></div>],
};
