import type { Meta, StoryObj } from '@storybook/preact';
import { LivingSpecsCard } from './LivingSpecsCard';
import type { ViewerState } from '../../types';

const meta: Meta<typeof LivingSpecsCard> = {
    title: 'Viewer/Activity/LivingSpecsCard',
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

// Capabilities loaded into context at specify time, none folded back yet.
export const LoadedOnly: Story = {
    render: () => (
        <LivingSpecsCard state={baseState({ livingSpecs: { loaded: ['checkout', 'cart'], synced: [] } })} />
    ),
};

// Loaded + some folded back at completion — the "folded back" marker appears.
export const LoadedAndSynced: Story = {
    render: () => (
        <LivingSpecsCard state={baseState({ livingSpecs: { loaded: ['checkout', 'cart'], synced: ['checkout'] } })} />
    ),
};

// No living-specs data → the card renders nothing.
export const None: Story = {
    render: () => <LivingSpecsCard state={baseState({})} />,
};
