import type { Meta, StoryObj } from '@storybook/preact';
import { MarkdownDoc } from './storyDoc';
// Real spec.md content, pulled straight from the repo at build time.
import spec060 from '../../../../specs/060-spec-context-tracking/spec.md?raw';
import spec008 from '../../../../specs/008-spec-viewer-ux/spec.md?raw';

/**
 * The viewer's **Spec** page. `Complete` renders a whole real spec.md so you can
 * see the full document; drill into individual renderers under Components.
 */
const meta: Meta<typeof MarkdownDoc> = {
    title: 'Viewer/Markdown Rendering/Spec',
    component: MarkdownDoc,
};
export default meta;
type Story = StoryObj<typeof MarkdownDoc>;

export const Complete: Story = {
    name: 'Complete (060 · speckit)',
    args: { md: spec060 },
};

export const Complete008: Story = {
    name: 'Complete (008 · sdd, richest)',
    args: { md: spec008 },
};
