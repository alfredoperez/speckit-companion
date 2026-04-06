import type { Meta, StoryObj } from '@storybook/preact';
import { Badge } from './Badge';

const meta: Meta<typeof Badge> = {
    title: 'Primitives/Badge',
    component: Badge,
};
export default meta;

type Story = StoryObj<typeof Badge>;

export const Draft: Story = { args: { text: 'DRAFT', variant: 'status' } };
export const Completed: Story = { args: { text: 'COMPLETED', variant: 'status' } };
export const Active: Story = { args: { text: 'ACTIVE', variant: 'status' } };
export const Stale: Story = { args: { text: '!', variant: 'stale' } };

export const AllBadges: Story = {
    render: () => (
        <div style="display: flex; gap: 12px; align-items: center;">
            <Badge text="DRAFT" variant="status" />
            <Badge text="COMPLETED" variant="status" />
            <Badge text="ACTIVE" variant="status" />
            <Badge text="!" variant="stale" />
        </div>
    ),
};
