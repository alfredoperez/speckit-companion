import type { Meta, StoryObj } from '@storybook/preact';
import { IntentCard } from './IntentCard';
import type { ViewerState } from '../../types';

const meta: Meta<typeof IntentCard> = {
    title: 'Viewer/Activity/IntentCard',
    component: IntentCard,
    decorators: [
        (Story) => (
            <div style="max-width: 640px; padding: 16px; background: var(--vscode-editor-background, #1e1e1e); color: var(--vscode-foreground, #cccccc);">
                <Story />
            </div>
        ),
    ],
};
export default meta;

type Story = StoryObj<typeof IntentCard>;

const baseState = (overrides: Partial<ViewerState>): ViewerState => ({
    status: 'implemented',
    activeStep: 'implement',
    steps: {},
    pulse: null,
    highlights: [],
    activeSubstep: null,
    footer: [],
    history: [],
    stepHistory: {},
    ...overrides,
});

// The full shape: goal sentence plus the out-of-scope fence.
export const GoalAndFence: Story = {
    render: () => (
        <IntentCard
            state={baseState({
                intent: 'Make the Activity panel show the captured reasoning trail so resume and review read the why, not just the timeline.',
                expectations: ['no schema changes — read-side only', 'no visual redesign of the panel', 'living-specs rendering stays out'],
            })}
        />
    ),
};

// Intent only — no expectations were recorded.
export const GoalOnly: Story = {
    render: () => <IntentCard state={baseState({ intent: 'Ship the drift action from the tree.' })} />,
};

// Neither field: the card renders nothing (no empty shell).
export const Absent: Story = {
    render: () => <IntentCard state={baseState({})} />,
};
