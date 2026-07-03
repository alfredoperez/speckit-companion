import type { Meta, StoryObj } from '@storybook/preact';
import { VerifiedCard } from './VerifiedCard';
import type { ViewerState } from '../../types';

const meta: Meta<typeof VerifiedCard> = {
    title: 'Viewer/Activity/VerifiedCard',
    component: VerifiedCard,
    decorators: [
        (Story) => (
            <div style="max-width: 640px; padding: 16px; background: var(--vscode-editor-background, #1e1e1e); color: var(--vscode-foreground, #cccccc);">
                <Story />
            </div>
        ),
    ],
};
export default meta;

type Story = StoryObj<typeof VerifiedCard>;

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

// Structured checks with a command and a dismissed warning.
export const FullChecks: Story = {
    render: () => (
        <VerifiedCard
            state={baseState({
                verified: [
                    { what: 'full jest suite', command: 'npm test', result: '1149/1149 pass' },
                    { what: 'TypeScript compile', command: 'npm run compile', result: 'clean', warnings: ['setTimeout typing differs under ts-jest — typed loosely'] },
                ],
            })}
        />
    ),
};

// A legacy bare-string verification renders as its text.
export const LegacyString: Story = {
    render: () => <VerifiedCard state={baseState({ verified: [{ what: 'build clean' }] })} />,
};

// Odd count + varied lengths: pills pack content-width and wrap — no ghost
// grid cell, no height mismatch between siblings.
export const OddCountPacksWithoutHoles: Story = {
    render: () => (
        <VerifiedCard
            state={baseState({
                verified: [
                    { what: 'impeccable on rendered stories + changed source', result: '0 findings everywhere' },
                    { what: 'full jest + both tsc', result: '1173/1173, clean' },
                    { what: 'screenshot review of Proof + Work tabs', result: 'matches the sketch; strip reads in one line' },
                ],
            })}
        />
    ),
};

export const Absent: Story = {
    render: () => <VerifiedCard state={baseState({})} />,
};
