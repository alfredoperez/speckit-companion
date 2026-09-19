import type { Meta, StoryObj } from '@storybook/preact';
import { navState } from '../signals';
import { StaleBanner } from './StaleBanner';
import { mockNavState, stalePlan } from './__stories__/mockData';

const meta: Meta<typeof StaleBanner> = {
    title: 'VS Code Extension/Spec Viewer/Stale banner',
    component: StaleBanner,
};
export default meta;

type Story = StoryObj<typeof StaleBanner>;

export const Visible: Story = {
    render: () => {
        navState.value = mockNavState({
            currentDoc: 'plan',
            stalenessMap: stalePlan,
        });
        return <StaleBanner />;
    },
};

export const Hidden: Story = {
    render: () => {
        navState.value = mockNavState({ currentDoc: 'spec' });
        return <StaleBanner />;
    },
};
