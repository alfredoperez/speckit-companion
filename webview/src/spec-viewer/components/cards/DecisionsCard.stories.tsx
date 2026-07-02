import type { Meta, StoryObj } from '@storybook/preact';
import { DecisionsCard } from './DecisionsCard';
import type { ViewerState } from '../../types';

const meta: Meta<typeof DecisionsCard> = {
    title: 'Viewer/Activity/DecisionsCard',
    component: DecisionsCard,
    decorators: [
        (Story) => (
            <div style="max-width: 640px; padding: 16px; background: var(--vscode-editor-background, #1e1e1e); color: var(--vscode-foreground, #cccccc);">
                <Story />
            </div>
        ),
    ],
};
export default meta;

type Story = StoryObj<typeof DecisionsCard>;

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

// Structured decisions with the why and the road not taken.
export const Structured: Story = {
    render: () => (
        <DecisionsCard
            state={baseState({
                decisions: [
                    { decision: 'normalize in the derivation, webview stays a dumb renderer', why: 'injection safety trivial via JSX text; tests live on the extension side', rejected: 'per-card defensive parsing' },
                    { decision: 'requirements captured as coverage titles', why: 'readable exactly where the data is rendered', rejected: 'separate requirements list at specify time' },
                ],
            })}
        />
    ),
};

// Legacy string decisions (normalized upstream to {decision}) render as before.
export const Legacy: Story = {
    render: () => (
        <DecisionsCard
            state={baseState({
                decisions: [{ decision: 'use the store' }, { decision: 'disable, not hide' }],
            })}
        />
    ),
};

// Real-volume payload: five decisions with long why/rejected lines (the 384 shape).
export const RealVolume: Story = {
    render: () => (
        <DecisionsCard
            state={baseState({
                decisions: [
                    { decision: 'actions dispatch to the AI session, never execute workspace Python', why: 'one-way dispatch is the architecture; isolation rule forbids depending on workspace .specify', rejected: 'child_process to drift.py with an output panel' },
                    { decision: 'row health computed in TS mirroring the CLI rules', why: 'the TS model exists precisely as the no-Python mirror; reuses its glob matcher', rejected: 'shelling to the Python scripts or mtime-based drift guesses' },
                    { decision: 'async time-bounded health with silent fallback', why: 'the tree must render identically to today on any failure', rejected: 'background polling and file watchers' },
                    { decision: 'health cache keyed by spec path, cleared on refresh', why: 'one git call per capability per refresh, not per tree paint', rejected: 'recompute on every getChildren' },
                    { decision: 'drift shown via icon warning-color plus a description dot', why: 'TreeItem has no colored-description API; icon color is the supported channel', rejected: 'custom SVG badges' },
                ],
            })}
        />
    ),
};

// Long text wraps inside the card.
export const LongText: Story = {
    render: () => (
        <DecisionsCard
            state={baseState({
                decisions: [
                    { decision: 'a very long decision line that should wrap gracefully within the activity card instead of overflowing the panel horizontally even on narrow viewports', why: 'an equally long rationale that exercises the wrapping behavior of the detail line under the decision text to make sure nothing clips' },
                ],
            })}
        />
    ),
};
