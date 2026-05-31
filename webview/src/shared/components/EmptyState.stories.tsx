import type { Meta, StoryObj } from '@storybook/preact';
import { EmptyState } from './EmptyState';
import { Button } from './Button';

const meta: Meta<typeof EmptyState> = {
    title: 'Primitives/EmptyState',
    component: EmptyState,
};
export default meta;

type Story = StoryObj<typeof EmptyState>;

export const Default: Story = {
    args: {
        label: 'No activity recorded yet',
    },
};

export const WithIcon: Story = {
    args: {
        icon: '📝',
        label: 'No specs yet',
    },
};

export const WithDescription: Story = {
    args: {
        icon: '📋',
        label: 'No tasks yet',
        description: 'Tasks appear here once the AI generates them from your plan.',
    },
};

export const WithAction: Story = {
    args: {
        icon: '✨',
        label: 'Start your first spec',
        description: "Specs are the structured way to describe features before code. Use the create button or the command palette.",
        action: <Button label="Create Spec" variant="primary" />,
    },
};

export const SidebarShape: Story = {
    render: () => (
        <div style="width: 280px; border: 1px solid var(--border, #444); border-radius: 6px; padding: 16px; background: var(--bg-elevated, #1e1e1e);">
            <EmptyState
                icon="📂"
                label="No specs in this workspace"
                description="Run 'SpecKit: Create Spec' from the command palette to get started."
            />
        </div>
    ),
};
