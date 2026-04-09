import type { Meta, StoryObj } from '@storybook/preact';
import { InlineEditor } from './InlineEditor';

const meta: Meta<typeof InlineEditor> = {
    title: 'Viewer/InlineEditor',
    component: InlineEditor,
};
export default meta;

type Story = StoryObj<typeof InlineEditor>;

export const LineMode: Story = {
    args: {
        mode: 'line',
        lineNum: 12,
        lineType: 'paragraph',
        onSubmit: (comment: string) => console.log('submit', comment),
        onCancel: () => console.log('cancel'),
        onContextAction: (action: string) => console.log('action', action),
    },
};

export const RowMode: Story = {
    decorators: [(Story) => <table><tbody><Story /></tbody></table>],
    args: {
        mode: 'row',
        lineNum: 3,
        lineType: 'acceptance',
        scenarioContent: 'Given a user with valid credentials, When they submit the login form, Then they are redirected to the dashboard',
        onSubmit: (comment: string) => console.log('submit', comment),
        onCancel: () => console.log('cancel'),
        onContextAction: (action: string) => console.log('action', action),
    },
};
