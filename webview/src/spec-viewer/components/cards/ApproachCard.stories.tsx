import type { Meta, StoryObj } from '@storybook/preact';
import { ApproachCard } from './ApproachCard';
import type { ViewerState } from '../../types';

const meta: Meta<typeof ApproachCard> = {
    title: 'Viewer/Activity/ApproachCard',
    component: ApproachCard,
    decorators: [
        (Story) => (
            <div style="max-width: 640px; padding: 16px; background: var(--vscode-editor-background, #1e1e1e); color: var(--vscode-foreground, #cccccc);">
                <Story />
            </div>
        ),
    ],
};
export default meta;

type Story = StoryObj<typeof ApproachCard>;

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

// Approach text plus the sizing line from the classification inputs.
export const WithClassification: Story = {
    render: () => (
        <ApproachCard
            state={baseState({
                status: 'implementing',
                approach: 'Normalize the fields in the derivation; render via one card per family.',
                classification: { projectedFiles: 9, projectedTasks: 11, scopeSignal: 'none', verdict: 'normal' },
                lastAction: 'T011 complete — all gates green',
            })}
        />
    ),
};

// No classification recorded — renders exactly as before.
export const WithoutClassification: Story = {
    render: () => (
        <ApproachCard
            state={baseState({
                status: 'implementing',
                approach: 'Ship the drift action from the tree.',
                lastAction: 'tests green',
            })}
        />
    ),
};
