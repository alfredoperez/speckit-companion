import type { Meta, StoryObj } from '@storybook/preact';
import { navState } from '../signals';
import { RemovedDocBanner } from './RemovedDocBanner';
import { mockDoc, mockNavState } from './__stories__/mockData';

const meta: Meta<typeof RemovedDocBanner> = {
    title: 'VS Code Extension/Spec Viewer/Removed document banner',
    component: RemovedDocBanner,
};
export default meta;

type Story = StoryObj<typeof RemovedDocBanner>;

export const Visible: Story = {
    render: () => {
        navState.value = mockNavState({
            currentDoc: 'spec',
            removedDocument: 'Plan',
            coreDocs: [
                mockDoc('spec', true, 'Specification'),
                mockDoc('plan', false, 'Plan'),
                mockDoc('tasks', true, 'Tasks'),
            ],
        });
        return <RemovedDocBanner />;
    },
};

export const Hidden: Story = {
    render: () => {
        navState.value = mockNavState({ currentDoc: 'spec' });
        return <RemovedDocBanner />;
    },
};
