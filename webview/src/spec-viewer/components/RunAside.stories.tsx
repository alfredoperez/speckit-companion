import type { Meta, StoryObj } from '@storybook/preact';
import { navState, viewerState } from '../signals';
import type { ViewerState } from '../types';
import { RunAside } from './RunAside';
import { mockNavState } from './__stories__/mockData';

const baseVs = (over: Partial<ViewerState>): ViewerState => ({
    status: 'implementing',
    activeStep: 'implement',
    steps: {},
    pulse: null,
    highlights: [],
    activeSubstep: null,
    footer: [],
    history: [],
    stepHistory: {},
    ...over,
} as ViewerState);

const meta: Meta<typeof RunAside> = {
    title: 'Viewer/RunAside',
    component: RunAside,
    decorators: [(Story) => <div style="max-width: 260px;"><Story /></div>],
};
export default meta;
type Story = StoryObj<typeof RunAside>;

export const MidRun: Story = {
    render: () => {
        navState.value = mockNavState({ currentTask: 'T021', taskCompletionPercent: 66 });
        viewerState.value = baseVs({
            verified: [{ what: 'jest', command: 'npx jest', result: 'pass' }] as ViewerState['verified'],
        });
        return <RunAside />;
    },
};

export const Completed: Story = {
    render: () => {
        navState.value = mockNavState({ taskCompletionPercent: 100 });
        viewerState.value = baseVs({
            status: 'completed',
            verified: [
                { what: 'jest', command: 'npx jest', result: 'pass' },
                { what: 'build', command: 'npm run compile', result: 'pass' },
            ] as ViewerState['verified'],
        });
        return <RunAside />;
    },
};

export const SparseFacts: Story = {
    name: 'Sparse facts (rows render only when present)',
    render: () => {
        navState.value = mockNavState({ currentTask: null, taskCompletionPercent: 0 });
        viewerState.value = baseVs({ status: 'planned', activeStep: 'plan' });
        return <RunAside />;
    },
};
