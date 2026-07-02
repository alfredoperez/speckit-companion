import type { Meta, StoryObj } from '@storybook/preact';
import { CoverageCard } from './CoverageCard';
import type { ViewerState } from '../../types';

const meta: Meta<typeof CoverageCard> = {
    title: 'Viewer/Activity/CoverageCard',
    component: CoverageCard,
    decorators: [
        (Story) => (
            <div style="max-width: 640px; padding: 16px; background: var(--vscode-editor-background, #1e1e1e); color: var(--vscode-foreground, #cccccc);">
                <Story />
            </div>
        ),
    ],
};
export default meta;

type Story = StoryObj<typeof CoverageCard>;

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

// Titled requirements with a partially-covered rollup.
export const TitledPartialCoverage: Story = {
    render: () => (
        <CoverageCard
            state={baseState({
                coverage: [
                    { req: 'FR-001', title: 'Capability nodes offer a drift action', tasks: ['T002', 'T003'], tests: ['livingSpecsCommands.test.ts::drift'] },
                    { req: 'FR-002', title: 'Coverage action mirrors drift', tasks: ['T005'], tests: [] },
                    { req: 'FR-003', title: 'Adopt reachable from the view menu', tasks: ['T006'], tests: ['livingSpecsCommands.test.ts::adopt'] },
                ],
            })}
        />
    ),
};

// Ids only (no titles captured) — still renders cleanly.
export const IdsOnly: Story = {
    render: () => (
        <CoverageCard
            state={baseState({
                coverage: [
                    { req: 'FR-001', tasks: ['T001'], tests: ['a.test.ts'] },
                    { req: 'FR-002', tasks: ['T002'], tests: [] },
                ],
            })}
        />
    ),
};

// Real-volume payload: eleven rows with long ::-qualified test refs (the 384 shape).
export const RealVolume: Story = {
    render: () => (
        <CoverageCard
            state={baseState({
                coverage: Array.from({ length: 11 }, (_, i) => ({
                    req: 'FR-' + String(i + 1).padStart(3, '0'),
                    title: ['Capability nodes offer a drift action', 'Coverage action mirrors drift', 'Adopt reachable from the view menu', 'Dispatch goes through the provider path', 'Actions gate on the installed extension', 'Rows surface coverage state', 'Rows surface a drift indicator', 'Health is best-effort and non-blocking', 'The view offers a refresh action', 'New behavior is covered by tests', 'Docs updated in the same change'][i],
                    tasks: ['T00' + ((i % 4) + 1)],
                    tests: i % 3 === 0 ? [] : ['livingSpecsCommands.test.ts::dispatches the ' + (i % 2 ? 'coverage' : 'drift') + ' command scoped to the invoked capability'],
                })),
            })}
        />
    ),
};

// Mid-pipeline: requirements tracked, no tests mapped yet — one summary line, not thirteen repeats.
export const AllUntested: Story = {
    render: () => (
        <CoverageCard
            state={baseState({
                coverage: Array.from({ length: 13 }, (_, i) => ({
                    req: 'FR-' + String(i + 1).padStart(3, '0'),
                    tasks: ['T001'],
                    tests: [],
                })),
            })}
        />
    ),
};

export const Absent: Story = {
    render: () => <CoverageCard state={baseState({})} />,
};
