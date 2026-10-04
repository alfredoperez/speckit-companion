/**
 * A bug's raw report open in the viewer: the Assessment tab as plain markdown,
 * read-only, with the Story tab one click away. The story and decision pages
 * themselves, in every state, live in `ReportPages.stories.tsx`.
 */

import type { Meta, StoryObj } from '@storybook/preact';
import { ReportViewer, cartTotalSkipsFirst } from './ReportPages.stories';

const meta: Meta = {
    title: 'VS Code Extension/Spec Viewer/Bug report',
    parameters: {
        layout: 'fullscreen',
        docs: {
            description: {
                component:
                    'A raw bug report from Spec Kit\'s bug commands, opened read-only in the real viewer with ' +
                    'Story, Assessment, Fix and Test on the rail. The text is a real run\'s reports.',
            },
        },
    },
};
export default meta;
type Story = StoryObj;

export const AllReports: Story = {
    name: 'All reports',
    render: () => <ReportViewer fixture={cartTotalSkipsFirst} initialDocument="assessment" />,
};
