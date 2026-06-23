import type { Meta, StoryObj } from '@storybook/preact';
import { MarkdownDoc } from './storyDoc';
import plan060 from '../../../../specs/060-spec-context-tracking/plan.md?raw';

/** The viewer's **Plan** page — a whole real plan.md, Technical Context grid and
 * Constitution Check rows included. */
const meta: Meta<typeof MarkdownDoc> = {
    title: 'Viewer/Markdown Rendering/Plan',
    component: MarkdownDoc,
};
export default meta;
type Story = StoryObj<typeof MarkdownDoc>;

export const Complete: Story = {
    name: 'Complete (060 · speckit)',
    args: { md: plan060 },
};
