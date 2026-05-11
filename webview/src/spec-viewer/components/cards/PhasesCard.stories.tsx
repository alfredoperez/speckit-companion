import type { Meta, StoryObj } from '@storybook/preact';
import { PhasesCard } from './PhasesCard';
import type { ViewerState } from '../../types';

const meta: Meta<typeof PhasesCard> = {
    title: 'Viewer/Activity/PhasesCard',
    component: PhasesCard,
    decorators: [
        (Story) => (
            <div style="max-width: 640px; padding: 16px; background: var(--vscode-editor-background, #1e1e1e); color: var(--vscode-foreground, #cccccc);">
                <Story />
            </div>
        ),
    ],
};
export default meta;

type Story = StoryObj<typeof PhasesCard>;

const NOW = Date.now();
const iso = (offsetMs: number) => new Date(NOW - offsetMs).toISOString();

const baseState = (overrides: Partial<ViewerState>): ViewerState => ({
    status: 'specifying',
    activeStep: 'specify',
    steps: {},
    pulse: null,
    highlights: [],
    activeSubstep: null,
    footer: [],
    transitions: [],
    stepHistory: {},
    ...overrides,
});

// ── Specify just started, in flight ──────────────────────────
// Mirrors the ngx-dev-toolbar screenshot moment: /sdd:specify is
// running; specify has startedAt, no completedAt; substeps are
// streaming in. Duration shows "so far" because the step is live.

export const SpecifyInFlight: Story = {
    name: 'Specify in flight (just started)',
    render: () => (
        <PhasesCard
            state={baseState({
                status: 'specifying',
                activeStep: 'specify',
                stepHistory: {
                    specify: { startedAt: iso(45_000), completedAt: null },
                },
                transitions: [
                    { step: 'specify', substep: 'parsing', from: null, by: 'sdd', at: iso(44_000) },
                    { step: 'specify', substep: 'exploring', from: { step: 'specify', substep: 'parsing' }, by: 'sdd', at: iso(40_000) },
                    { step: 'specify', substep: 'writing-spec', from: { step: 'specify', substep: 'exploring' }, by: 'sdd', at: iso(15_000) },
                ],
            })}
        />
    ),
};

// ── Specify completed, plan in flight ────────────────────────
// User clicked the "Plan" forward button; specify got a
// completedAt; plan has startedAt and is now the in-flight phase.
// Specify's row reads "duration" with no "so far" suffix.

export const PlanInFlight: Story = {
    name: 'Plan in flight (specify completed)',
    render: () => (
        <PhasesCard
            state={baseState({
                status: 'planning',
                activeStep: 'plan',
                stepHistory: {
                    specify: { startedAt: iso(900_000), completedAt: iso(720_000) },
                    plan: { startedAt: iso(120_000), completedAt: null },
                },
                transitions: [
                    { step: 'specify', substep: 'writing-spec', from: null, by: 'sdd', at: iso(800_000) },
                    { step: 'plan', substep: 'research', from: { step: 'specify', substep: null }, by: 'sdd', at: iso(110_000) },
                    { step: 'plan', substep: 'design', from: { step: 'plan', substep: 'research' }, by: 'sdd', at: iso(60_000) },
                ],
            })}
        />
    ),
};

// ── All four phases recorded, implement in flight ───────────
// Final state of the pipeline — specify, plan, tasks all have
// completedAt; implement is live. The card shows a full vertical
// timeline of every phase with extension-stamped step durations.

export const FullPipelineImplementInFlight: Story = {
    name: 'All four phases — implement in flight',
    render: () => (
        <PhasesCard
            state={baseState({
                status: 'implementing',
                activeStep: 'implement',
                stepHistory: {
                    specify: { startedAt: iso(3_600_000), completedAt: iso(3_300_000) },
                    plan: { startedAt: iso(3_300_000), completedAt: iso(2_700_000) },
                    tasks: { startedAt: iso(2_700_000), completedAt: iso(2_400_000) },
                    implement: { startedAt: iso(900_000), completedAt: null },
                },
                transitions: [
                    { step: 'specify', substep: 'writing-spec', from: null, by: 'sdd', at: iso(3_500_000) },
                    { step: 'plan', substep: 'design', from: { step: 'specify', substep: null }, by: 'sdd', at: iso(3_000_000) },
                    { step: 'tasks', substep: null, from: { step: 'plan', substep: null }, by: 'sdd', at: iso(2_600_000) },
                    { step: 'implement', substep: 'phase1', from: { step: 'tasks', substep: null }, by: 'sdd', at: iso(800_000) },
                    { step: 'implement', substep: 'code-review', from: { step: 'implement', substep: 'phase1' }, by: 'sdd', at: iso(300_000) },
                ],
            })}
        />
    ),
};

// ── Completed spec ───────────────────────────────────────────
// Terminal state — every step has a completedAt. No "so far"
// suffix anywhere; durations are final.

export const Completed: Story = {
    name: 'Completed (terminal state)',
    render: () => (
        <PhasesCard
            state={baseState({
                status: 'completed',
                activeStep: 'implement',
                stepHistory: {
                    specify: { startedAt: iso(7_200_000), completedAt: iso(6_900_000) },
                    plan: { startedAt: iso(6_900_000), completedAt: iso(6_300_000) },
                    tasks: { startedAt: iso(6_300_000), completedAt: iso(6_000_000) },
                    implement: { startedAt: iso(6_000_000), completedAt: iso(60_000) },
                },
                transitions: [],
            })}
        />
    ),
};

// ── No history yet ───────────────────────────────────────────
// Pure draft — the card returns null and does not render. This
// story exists so reviewers can confirm the empty-state behavior
// (the activity panel is supposed to collapse when nothing has
// happened).

export const PureDraftHidden: Story = {
    name: 'Pure draft (renders nothing)',
    render: () => (
        <div>
            <p style="opacity: 0.6; font-style: italic;">
                Card returns null when stepHistory is empty — nothing renders below this line:
            </p>
            <PhasesCard state={baseState({ status: 'draft', stepHistory: {}, transitions: [] })} />
        </div>
    ),
};
