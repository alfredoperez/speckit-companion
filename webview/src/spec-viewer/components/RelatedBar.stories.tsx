import type { Meta, StoryObj } from '@storybook/preact';
import { navState } from '../signals';
import { RelatedBar } from './RelatedBar';
import { mockDoc, mockRelatedDoc, mockNavState } from './__stories__/mockData';

const meta: Meta<typeof RelatedBar> = {
    title: 'Viewer/RelatedBar',
    component: RelatedBar,
};
export default meta;

type Story = StoryObj<typeof RelatedBar>;

export const WithRelatedDocs: Story = {
    render: () => {
        navState.value = mockNavState({
            currentDoc: 'plan',
            relatedDocs: [
                mockRelatedDoc('api-schema', 'plan', 'API Schema'),
                mockRelatedDoc('db-schema', 'plan', 'DB Schema'),
            ],
        });
        return <RelatedBar />;
    },
};

export const ViewingRelatedDoc: Story = {
    render: () => {
        navState.value = mockNavState({
            currentDoc: 'api-schema',
            isViewingRelatedDoc: true,
            relatedDocs: [
                mockRelatedDoc('api-schema', 'plan', 'API Schema'),
                mockRelatedDoc('db-schema', 'plan', 'DB Schema'),
            ],
        });
        return <RelatedBar />;
    },
};

export const NoRelatedDocs: Story = {
    render: () => {
        navState.value = mockNavState({ currentDoc: 'spec', relatedDocs: [] });
        return <RelatedBar />;
    },
};
