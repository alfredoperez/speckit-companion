/**
 * Storybook stories for the Create New Spec form.
 *
 * The mock component lives in `../CreateSpecMock.tsx` so it can be
 * reused by the Viewer/Transitions/CreateSpec lifecycle entry.
 */

import type { Meta, StoryObj } from '@storybook/preact';
import { CreateSpecMock } from '../CreateSpecMock';

const meta: Meta = {
    title: 'SpecEditor/CreateSpec',
    parameters: {
        layout: 'fullscreen',
        docs: {
            description: {
                component:
                    'The Create New Spec form (a separate webview) is what the user sees before any spec exists. ' +
                    'Auto Mode is invoked here — the spec viewer never opens at status=draft.',
            },
        },
    },
};
export default meta;

type Story = StoryObj;

export const Empty: Story = {
    name: 'Empty (Create Spec disabled)',
    render: () => <CreateSpecMock />,
};

export const OverLimit: Story = {
    name: 'Over Limit (submission blocked)',
    render: () => (
        <CreateSpecMock
            initialContent={'A very long specification that exceeds the character limit…'}
            overLimit
        />
    ),
};

export const WithDraft: Story = {
    name: 'With Draft',
    render: () => (
        <CreateSpecMock
            initialContent={
                'Add a quiet-footer mode to the spec viewer.\n\n' +
                'Goal: hide premature lifecycle actions while a step is mid-generation, ' +
                'and rename the generic Approve button to the next workflow step’s label.\n\n' +
                'Constraint: extension code only — user .vscode/settings.json should not need ' +
                'to change. Verify by reproducing the screenshot from ngx-dev-toolbar.'
            }
        />
    ),
};

export const Submitting: Story = {
    name: 'Submitting',
    render: () => (
        <CreateSpecMock
            initialContent={
                'Add a quiet-footer mode to the spec viewer.\n\n' +
                'Goal: hide premature lifecycle actions while a step is mid-generation.'
            }
            submitting
        />
    ),
};
