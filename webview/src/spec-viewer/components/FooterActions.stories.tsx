import type { Meta, StoryObj } from '@storybook/preact';
import { navState } from '../signals';
import { FooterActions } from './FooterActions';
import { mockNavState } from './__stories__/mockData';

const meta: Meta<typeof FooterActions> = {
    title: 'Viewer/FooterActions',
    component: FooterActions,
};
export default meta;

type Story = StoryObj<typeof FooterActions>;

export const Active: Story = {
    render: () => {
        navState.value = mockNavState({
            footerState: { showApproveButton: true, approveText: 'Plan', enhancementButtons: [], specStatus: 'active' },
        });
        return <FooterActions initialSpecStatus="active" />;
    },
};

export const ActiveWithEnhancements: Story = {
    render: () => {
        navState.value = mockNavState({
            footerState: {
                showApproveButton: true,
                approveText: 'Plan',
                enhancementButtons: [{ label: 'Auto Mode', command: 'autoMode', icon: '⚡', tooltip: 'Run automatic pipeline' }],
                specStatus: 'active',
            },
        });
        return <FooterActions initialSpecStatus="active" />;
    },
};

export const TasksDone: Story = {
    render: () => {
        navState.value = mockNavState({
            footerState: { showApproveButton: false, approveText: '', enhancementButtons: [], specStatus: 'tasks-done' },
        });
        return <FooterActions initialSpecStatus="tasks-done" />;
    },
};

export const Completed: Story = {
    render: () => {
        navState.value = mockNavState({
            footerState: { showApproveButton: false, approveText: '', enhancementButtons: [], specStatus: 'completed' },
        });
        return <FooterActions initialSpecStatus="completed" />;
    },
};

export const Archived: Story = {
    render: () => {
        navState.value = mockNavState({
            footerState: { showApproveButton: false, approveText: '', enhancementButtons: [], specStatus: 'archived' },
        });
        return <FooterActions initialSpecStatus="archived" />;
    },
};
