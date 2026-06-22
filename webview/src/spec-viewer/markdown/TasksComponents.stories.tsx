import type { Meta, StoryObj } from '@storybook/preact';
import { MarkdownDoc } from './storyDoc';
// Real lean tasks + the real captured task summaries from spec 327 (companion).
import tasks327 from '../../../../specs/327-install-banner-responsive/tasks.md?raw';
import ctx327 from '../../../../specs/327-install-banner-responsive/.spec-context.json';

/** Tasks-page renderers in isolation: phase headers, and the capture merge that
 * folds what each task actually did + the files it touched into the checklist. */
const meta: Meta<typeof MarkdownDoc> = {
    title: 'Viewer/Markdown Rendering/Tasks/Components',
    component: MarkdownDoc,
};
export default meta;
type Story = StoryObj<typeof MarkdownDoc>;

export const PhaseHeaders: Story = {
    args: {
        md: [
            '## Phase 1: Setup (Shared Infrastructure)',
            '',
            '- [X] **T001** Copy the canonical schema into the runtime path',
            '- [X] **T002** Add the schema fixtures',
            '',
            '## Phase 3: User Story 1 — Trustworthy single status (P1) 🎯 MVP',
            '',
            '- [X] **T010** Implement deriveViewerState',
            '- [ ] **T011** Wire the header badge to ViewerState.status',
        ].join('\n'),
    },
};

export const TaskCapture: Story = {
    name: 'Task Capture (327 · real did/files)',
    args: {
        md: tasks327,
        summaries: (ctx327 as { task_summaries?: Record<string, { did?: string; files?: string[] }> }).task_summaries,
    },
};

export const TaskCaptureEmpty: Story = {
    name: 'Task Capture (no summaries)',
    args: {
        md: [
            '# Tasks',
            '',
            '- [x] **T001** Make `.install-banner` a query container',
            '- [ ] **T002** Add the `@container` rule so the actions stack below the text',
        ].join('\n'),
    },
};
