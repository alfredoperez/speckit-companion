import type { Meta, StoryObj } from '@storybook/preact';
import { MarkdownDoc } from './storyDoc';
// The "other" files some specs carry, pulled from real specs at build time.
import research060 from '../../../../specs/060-spec-context-tracking/research.md?raw';
import dataModel060 from '../../../../specs/060-spec-context-tracking/data-model.md?raw';
import quickstart060 from '../../../../specs/060-spec-context-tracking/quickstart.md?raw';
import schema060 from '../../../../specs/060-spec-context-tracking/contracts/spec-context.schema.json?raw';
import contract008 from '../../../../specs/008-spec-viewer-ux/contracts/webview-messages.md?raw';
import checklist060 from '../../../../specs/060-spec-context-tracking/checklists/requirements.md?raw';

/** Design-artifact files that hang off a step in the viewer's sub-rail. */
const meta: Meta<typeof MarkdownDoc> = {
    title: 'Viewer/Markdown Rendering/Artifacts',
    component: MarkdownDoc,
};
export default meta;
type Story = StoryObj<typeof MarkdownDoc>;

export const Research: Story = { args: { md: research060 } };

export const DataModel: Story = { args: { md: dataModel060 } };

export const Quickstart: Story = { args: { md: quickstart060 } };

export const ContractsSchema: Story = {
    name: 'Contracts — Schema (JSON)',
    args: { md: '```json\n' + schema060 + '\n```' },
};

export const ContractsMarkdown: Story = {
    name: 'Contracts — Markdown',
    args: { md: contract008 },
};

export const Checklist: Story = { args: { md: checklist060 } };
