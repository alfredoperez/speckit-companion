import type { Meta, StoryObj } from '@storybook/preact';
import { InlineEditor } from './InlineEditor';

const meta: Meta<typeof InlineEditor> = {
    title: 'Viewer/InlineEditor',
    component: InlineEditor,
};
export default meta;

type Story = StoryObj<typeof InlineEditor>;

const lineArgs = {
    onSubmit: (comment: string) => console.log('submit', comment),
    onCancel: () => console.log('cancel'),
    onContextAction: (action: string) => console.log('action', action),
};

// Single-card layout on a plain paragraph line: footer shows "Remove Line".
export const LineMode: Story = {
    args: {
        mode: 'line',
        lineNum: 12,
        lineType: 'paragraph',
        ...lineArgs,
    },
};

// Task line: footer carries two secondary actions (Toggle + Remove Task).
export const TaskMode: Story = {
    args: {
        mode: 'line',
        lineNum: 24,
        lineType: 'task',
        ...lineArgs,
    },
};

// Section heading line: footer shows "Remove Section".
export const SectionMode: Story = {
    args: {
        mode: 'line',
        lineNum: 5,
        lineType: 'section',
        ...lineArgs,
    },
};

// User story header line: footer shows "Remove Story".
export const UserStoryMode: Story = {
    args: {
        mode: 'line',
        lineNum: 8,
        lineType: 'user-story',
        ...lineArgs,
    },
};

// Edit mode: the same composer, pre-filled — "Save" instead of "Add Comment", and no
// line-removal actions, since revising a comment is not the moment to delete the line.
export const EditMode: Story = {
    args: {
        mode: 'line',
        lineNum: 12,
        lineType: 'paragraph',
        initialValue: 'Name the auth methods in scope for v1',
        submitLabel: 'Save',
        ...lineArgs,
    },
};

// Acceptance-scenario row: scenario context shows in the card header,
// primary actions right-aligned, no secondary action.
export const RowMode: Story = {
    decorators: [(Story) => <table><tbody><Story /></tbody></table>],
    args: {
        mode: 'row',
        lineNum: 3,
        lineType: 'acceptance',
        scenarioContent: 'Given a user with valid credentials, When they submit the login form, Then they are redirected to the dashboard',
        ...lineArgs,
    },
};
