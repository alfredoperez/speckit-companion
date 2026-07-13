import type { Meta, StoryObj } from '@storybook/preact';
import { MarkdownDoc } from '../../markdown/storyDoc';
import spec172 from '../../../../../specs/172-composable-command-nodes/spec.md?raw';
import plan172 from '../../../../../specs/172-composable-command-nodes/plan.md?raw';
import tasks172 from '../../../../../specs/172-composable-command-nodes/tasks.md?raw';
import research172 from '../../../../../specs/172-composable-command-nodes/research.md?raw';
import dataModel172 from '../../../../../specs/172-composable-command-nodes/data-model.md?raw';
import quickstart172 from '../../../../../specs/172-composable-command-nodes/quickstart.md?raw';
import checklist172 from '../../../../../specs/172-composable-command-nodes/checklists/requirements.md?raw';
import contract172 from '../../../../../specs/172-composable-command-nodes/contracts/assembly-and-parity.md?raw';
import './codex.css';

function RealDoc({ md }: { md: string }) { return <div class="codex-redesign codex-doc cx-page"><MarkdownDoc md={md} /></div>; }

const meta: Meta = {
  title: 'Redesign/Codex/Data Display',
  parameters: { layout: 'fullscreen' },
};
export default meta;
type Story = StoryObj;

export const Specification: Story = { render: () => <RealDoc md={spec172} /> };
export const Plan: Story = { render: () => <RealDoc md={plan172} /> };
export const Tasks: Story = { render: () => <RealDoc md={tasks172} /> };
export const Decisions: Story = { render: () => <RealDoc md={research172} /> };
export const DataModel: Story = { render: () => <RealDoc md={dataModel172} /> };
export const Quickstart: Story = { render: () => <RealDoc md={quickstart172} /> };
export const Checklist: Story = { render: () => <RealDoc md={checklist172} /> };
export const TablesAndCode: Story = { render: () => <RealDoc md={contract172} /> };
