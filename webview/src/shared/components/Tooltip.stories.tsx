import type { Meta, StoryObj } from '@storybook/preact';
import { Tooltip } from './Tooltip';
import { Button } from './Button';

const meta: Meta<typeof Tooltip> = {
    title: 'Primitives/Tooltip',
    component: Tooltip,
};
export default meta;

type Story = StoryObj<typeof Tooltip>;

export const Default: Story = {
    args: {
        label: 'A tooltip is just a typed wrapper around the native title attribute',
        children: <span style="text-decoration: underline; text-underline-offset: 4px;">Hover this text</span>,
    },
};

export const OnButton: Story = {
    args: {
        label: 'Mark this spec complete (affects the whole spec)',
        children: <Button label="Complete" variant="primary" />,
    },
};

export const OnIcon: Story = {
    args: {
        label: 'Refresh',
        children: <span style="font-size: 20px;">🔄</span>,
    },
};

export const Inline: Story = {
    render: () => (
        <p style="max-width: 480px; line-height: 1.6;">
            The shared primitive layer ships <Tooltip label="Button, Badge, Card, Input, Toast, Tooltip, EmptyState, UndoToast">eight components</Tooltip>{' '}
            today, and each one is{' '}
            <Tooltip label="Catalogued in webview/src/shared/components/index.ts">discoverable from one index</Tooltip>.
        </p>
    ),
};
