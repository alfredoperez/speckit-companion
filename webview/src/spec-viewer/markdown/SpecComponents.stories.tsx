import type { Meta, StoryObj } from '@storybook/preact';
import { MarkdownDoc } from './storyDoc';

/** Individual Spec-page renderers, each shown in isolation (real excerpts). */
const meta: Meta<typeof MarkdownDoc> = {
    title: 'Viewer/Markdown Rendering/Spec/Components',
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
