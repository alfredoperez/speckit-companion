import type { Meta, StoryObj } from '@storybook/preact';
import { InlineComment } from './InlineComment';

const meta: Meta<typeof InlineComment> = {
    title: 'Viewer/InlineComment',
    component: InlineComment,
};
export default meta;

type Story = StoryObj<typeof InlineComment>;

const mockRefinement = {
    id: 'ref-1',
    lineNum: 5,
    lineContent: 'The user should be able to login',
    comment: 'This should specify which auth methods are supported',
    lineType: 'paragraph' as const,
};

export const LineMode: Story = {
    args: {
        refinement: mockRefinement,
        mode: 'line',
        onDelete: (id: string) => console.log('delete', id),
    },
};

export const RowMode: Story = {
    decorators: [(Story) => <table><tbody><Story /></tbody></table>],
    args: {
        refinement: { ...mockRefinement, lineType: 'acceptance' as const, comment: 'Add error case for invalid credentials' },
        mode: 'row',
        onDelete: (id: string) => console.log('delete', id),
    },
};
