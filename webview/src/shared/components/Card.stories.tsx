import type { Meta, StoryObj } from '@storybook/preact';
import { Card } from './Card';
import { Button } from './Button';
import { Badge } from './Badge';

const meta: Meta<typeof Card> = {
    title: 'Primitives/Card',
    component: Card,
};
export default meta;

type Story = StoryObj<typeof Card>;

export const Default: Story = {
    args: {
        title: 'Default card',
        children: 'Body content sits below the header. The card paints a border + elevated background using design-system tokens.',
    },
};

export const TitleOnly: Story = {
    args: {
        title: 'Just a title',
    },
};

export const ChildrenOnly: Story = {
    args: {
        children: 'No header — the card collapses to just the body when title and actions are both omitted.',
    },
};

export const WithActions: Story = {
    args: {
        title: 'Approach',
        actions: <Button label="Run refinement" variant="ghost" />,
        children: 'Header actions render on the right side of the header. Buttons are the most common slot but any JSX works.',
    },
};

export const WithStatusBadge: Story = {
    args: {
        title: 'Phases',
        actions: <Badge text="implementing" status="implementing" />,
        children: 'A status badge in the header is the canonical way to surface where the spec is without breaking the card layout.',
    },
};

export const NestedExample: Story = {
    render: () => (
        <div style="display: flex; flex-direction: column; gap: 16px; max-width: 480px;">
            <Card title="Tasks" actions={<Badge text="33%" variant="passthrough" class="task-row__status" />}>
                <ul style="margin: 0; padding-left: 18px; color: var(--text-secondary);">
                    <li>Add destructive Button variant</li>
                    <li>Wrap raw buttons in shared component</li>
                    <li>Document the design system</li>
                </ul>
            </Card>
            <Card title="Concerns">
                <p style="margin: 0; color: var(--text-secondary);">No concerns recorded.</p>
            </Card>
        </div>
    ),
};
