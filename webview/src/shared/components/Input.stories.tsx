import type { Meta, StoryObj } from '@storybook/preact';
import { Input } from './Input';

const meta: Meta<typeof Input> = {
    title: 'Primitives/Input',
    component: Input,
    argTypes: {
        variant: { control: 'select', options: ['refine', 'inline-edit', 'editor'] },
    },
};
export default meta;

type Story = StoryObj<typeof Input>;

export const Refine: Story = { args: { variant: 'refine', placeholder: 'Describe how to improve this line...' } };
export const InlineEdit: Story = { args: { variant: 'inline-edit', placeholder: 'Edit content...' } };
export const Editor: Story = { args: { variant: 'editor', placeholder: 'Write your spec...' } };

export const AllVariants: Story = {
    render: () => (
        <div style="display: flex; flex-direction: column; gap: 12px; max-width: 400px;">
            <Input variant="refine" placeholder="Refine input..." />
            <Input variant="inline-edit" placeholder="Inline edit input..." />
            <Input variant="editor" placeholder="Editor input..." />
        </div>
    ),
};
