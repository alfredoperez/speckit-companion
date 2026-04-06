import type { Meta, StoryObj } from '@storybook/preact';
import { navState } from '../signals';
import { SpecHeader } from './SpecHeader';
import { mockNavState } from './__stories__/mockData';

const meta: Meta<typeof SpecHeader> = {
    title: 'Viewer/SpecHeader',
    component: SpecHeader,
};
export default meta;

type Story = StoryObj<typeof SpecHeader>;

export const Full: Story = {
    render: () => {
        navState.value = mockNavState({
            badgeText: 'COMPLETED',
            createdDate: 'Apr 4, 2026',
            specContextName: 'Explorer Viewer Fixes',
            branch: 'main',
            docTypeLabel: 'Tasks',
        });
        return <SpecHeader />;
    },
};

export const ActiveDraft: Story = {
    render: () => {
        navState.value = mockNavState({
            badgeText: 'DRAFT',
            createdDate: 'Apr 6, 2026',
            specContextName: 'New Feature',
            branch: 'feat/new-feature',
            docTypeLabel: 'Spec',
        });
        return <SpecHeader />;
    },
};

export const MinimalTitle: Story = {
    render: () => {
        navState.value = mockNavState({
            badgeText: null,
            createdDate: null,
            specContextName: 'Minimal Spec',
            branch: null,
            docTypeLabel: 'Spec',
        });
        return <SpecHeader />;
    },
};

export const Empty: Story = {
    render: () => {
        navState.value = mockNavState({
            badgeText: null,
            createdDate: null,
            specContextName: null,
            branch: null,
        });
        return <SpecHeader />;
    },
};
