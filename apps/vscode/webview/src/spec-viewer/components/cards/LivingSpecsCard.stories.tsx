import type { Meta, StoryObj } from '@storybook/preact';
import { LivingSpecsCard } from './LivingSpecsCard';
import type { ViewerState } from '../../types';

const meta: Meta<typeof LivingSpecsCard> = {
    title: 'VS Code Extension/Spec Viewer/Overview/Living specs card',
    component: LivingSpecsCard,
    decorators: [
        (Story) => (
            <div style="max-width: 640px; padding: 16px; background: var(--vscode-editor-background, #1e1e1e); color: var(--vscode-foreground, #cccccc);">
                <Story />
            </div>
        ),
    ],
};
export default meta;

type Story = StoryObj<typeof LivingSpecsCard>;

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

// Loaded only: a single "Read for context" group.
export const LoadedOnly: Story = {
    render: () => (
        <LivingSpecsCard state={baseState({ livingSpecs: { loaded: ['checkout', 'cart'], synced: [] } })} />
    ),
};

// Both groups: "Updated by this run" first, then "Read for context".
export const LoadedAndSynced: Story = {
    render: () => (
        <LivingSpecsCard state={baseState({ livingSpecs: { loaded: ['checkout', 'cart'], synced: ['checkout'] } })} />
    ),
};

// A capability updated but not loaded this run still lands under "Updated by this run".
export const SyncedNotLoaded: Story = {
    render: () => (
        <LivingSpecsCard state={baseState({ livingSpecs: { loaded: ['cart'], synced: ['checkout'] } })} />
    ),
};

// A very long capability name must truncate with an ellipsis, not overflow.
export const LongName: Story = {
    render: () => (
        <LivingSpecsCard
            state={baseState({
                livingSpecs: {
                    loaded: ['checkout-payment-fraud-detection-and-risk-scoring-pipeline'],
                    synced: ['checkout-payment-fraud-detection-and-risk-scoring-pipeline'],
                },
            })}
        />
    ),
};

// No living-specs data → the card renders nothing.
export const None: Story = {
    render: () => <LivingSpecsCard state={baseState({})} />,
};
