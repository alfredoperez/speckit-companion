import type { Meta, StoryObj } from '@storybook/preact';
import { MarkdownDoc } from './storyDoc';
import tasks060 from '../../../../specs/060-spec-context-tracking/tasks.md?raw';
import tasks394 from '../../../../specs/394-adopt-codex-design/tasks.md?raw';
import context394 from '../../../../specs/394-adopt-codex-design/.spec-context.json?raw';

/** The viewer's **Tasks** page — a whole real phased tasks.md. */
const meta: Meta<typeof MarkdownDoc> = {
    title: 'Viewer/Markdown Rendering/Tasks',
    component: MarkdownDoc,
};
export default meta;
type Story = StoryObj<typeof MarkdownDoc>;

export const Complete: Story = {
    name: 'Complete (060 · speckit)',
    args: { md: tasks060 },
};

// The full-dress case, and the one to review styling against: a real Companion
// run's tasks.md with its real capture. It exercises every treatment at once —
// phase headers with priority chips, wave headings, checkpoint callouts, task
// metadata chips (id / [P] / [US#]), inline code and file references inside a
// task sentence, and the per-task capture line (what it did, which files) that
// only appears because the run journaled it.
const summaries394 = (() => {
    const ctx = JSON.parse(context394) as {
        task_summaries?: Record<string, { did?: string; files?: string[] }>;
        taskSummaries?: Record<string, { did?: string; files?: string[] }>;
    };
    return ctx.task_summaries ?? ctx.taskSummaries ?? {};
})();

export const WithCapture: Story = {
    name: 'With run capture (394 · companion)',
    args: { md: tasks394, summaries: summaries394 },
};
