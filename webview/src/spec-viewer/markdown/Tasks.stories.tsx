import type { Meta, StoryObj } from '@storybook/preact';
import { MarkdownDoc } from './storyDoc';
import tasks060 from '../../../../specs/060-spec-context-tracking/tasks.md?raw';

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
