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

// Resolved capabilities: each renders a clickable chip that opens the Living
// Specs viewer; one is folded back with delta counts.
export const ResolvedChips: Story = {
    render: () => (
        <LivingSpecsCard
            state={baseState({
                livingSpecs: {
                    loaded: ['todos', 'notes-ui'],
                    synced: ['todos'],
                    capabilities: [
                        {
                            name: 'todos',
                            available: true,
                            synced: true,
                            delta: { added: 1, modified: 2 },
                            specPath: 'capabilities/todos/spec.md',
                        },
                        {
                            name: 'notes-ui',
                            available: true,
                            synced: false,
                            specPath: 'capabilities/notes-ui/spec.md',
                        },
                    ],
                },
            })}
        />
    ),
};

// Capabilities that could not be resolved (unknown name / missing file) render
// as plain, non-clickable names.
export const Unresolved: Story = {
    render: () => (
        <LivingSpecsCard
            state={baseState({
                livingSpecs: {
                    loaded: ['todos', 'notes-ui'],
                    synced: ['todos'],
                    capabilities: [
                        { name: 'todos', available: false, synced: true },
                        { name: 'notes-ui', available: false, synced: false },
                    ],
                },
            })}
        />
    ),
};

// Capabilities loaded into context at specify time, none folded back yet.
// (Names-only legacy payload — no `capabilities` field — keeps the chip list.)
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

// A capability folded back but not loaded this run — still listed, marked.
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
