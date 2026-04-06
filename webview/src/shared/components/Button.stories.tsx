import type { Meta, StoryObj } from '@storybook/preact';
import { Button } from './Button';

const meta: Meta<typeof Button> = {
    title: 'Primitives/Button',
    component: Button,
    argTypes: {
        variant: { control: 'select', options: ['primary', 'secondary', 'ghost', 'enhancement'] },
        disabled: { control: 'boolean' },
    },
};
export default meta;

type Story = StoryObj<typeof Button>;

export const Primary: Story = { args: { label: 'Approve', variant: 'primary' } };
export const Secondary: Story = { args: { label: 'Edit Source', variant: 'secondary' } };
export const Ghost: Story = { args: { label: 'Cancel', variant: 'ghost' } };
export const Enhancement: Story = { args: { label: 'Auto Mode', variant: 'enhancement', icon: '⚡' } };
export const Disabled: Story = { args: { label: 'Disabled', variant: 'primary', disabled: true } };

export const AllVariants: Story = {
    render: () => (
        <div style="display: flex; gap: 8px; align-items: center;">
            <Button label="Primary" variant="primary" />
            <Button label="Secondary" variant="secondary" />
            <Button label="Ghost" variant="ghost" />
            <Button label="Enhancement" variant="enhancement" icon="⚡" />
            <Button label="Disabled" variant="primary" disabled />
        </div>
    ),
};
