import type { Meta, StoryObj } from '@storybook/preact';
import { navState } from '../signals';
import { RemovedDocBanner } from './RemovedDocBanner';
import { mockNavState } from './__stories__/mockData';

const meta: Meta<typeof RemovedDocBanner> = {
    title: 'VS Code Extension/Spec Viewer/Removed document banner',
    component: RemovedDocBanner,
};
export default meta;

type Story = StoryObj<typeof RemovedDocBanner>;

export const Visible: Story = {
    render: () => {
        navState.value = mockNavState({ currentDoc: 'spec', removedDocument: 'Plan' });
        return <RemovedDocBanner />;
    },
};

export const Hidden: Story = {
    render: () => {
        navState.value = mockNavState({ currentDoc: 'spec' });
        return <RemovedDocBanner />;
    },
};
