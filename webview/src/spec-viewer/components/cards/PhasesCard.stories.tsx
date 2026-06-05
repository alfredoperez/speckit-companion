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
// Mirrors the ngx-dev-toolbar screenshot moment: the specify step
// is running; specify has startedAt, no completedAt; substeps are
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
                    { step: 'specify', substep: 'parsing', from: null, by: 'cli', at: iso(44_000) },
                    { step: 'specify', substep: 'exploring', from: { step: 'specify', substep: 'parsing' }, by: 'cli', at: iso(40_000) },
                    { step: 'specify', substep: 'writing-spec', from: { step: 'specify', substep: 'exploring' }, by: 'cli', at: iso(15_000) },
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
                    { step: 'specify', substep: 'writing-spec', from: null, by: 'cli', at: iso(800_000) },
                    { step: 'plan', substep: 'research', from: { step: 'specify', substep: null }, by: 'cli', at: iso(110_000) },
                    { step: 'plan', substep: 'design', from: { step: 'plan', substep: 'research' }, by: 'cli', at: iso(60_000) },
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
                    { step: 'specify', substep: 'writing-spec', from: null, by: 'cli', at: iso(3_500_000) },
                    { step: 'plan', substep: 'design', from: { step: 'specify', substep: null }, by: 'cli', at: iso(3_000_000) },
                    { step: 'tasks', substep: null, from: { step: 'plan', substep: null }, by: 'cli', at: iso(2_600_000) },
                    { step: 'implement', substep: 'phase1', from: { step: 'tasks', substep: null }, by: 'cli', at: iso(800_000) },
                    { step: 'implement', substep: 'code-review', from: { step: 'implement', substep: 'phase1' }, by: 'cli', at: iso(300_000) },
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

// ── Overall-header span ───────────────────────────────
// Multi-phase completed spec. The overall header at the top must
// render all three stats with real values: "Started" (absolute of
// the first phase start), "Total" (full span, no "so far"), and
// "Ended" (absolute of the last phase completion). Nothing is in
// flight, so no stat reads "in progress".

export const OverallHeaderSpan: Story = {
    name: 'Overall header span (started / total / ended)',
    render: () => (
        <PhasesCard
            state={baseState({
                status: 'completed',
                activeStep: 'implement',
                stepHistory: {
                    specify: { startedAt: iso(10_800_000), completedAt: iso(10_200_000) },
                    plan: { startedAt: iso(10_200_000), completedAt: iso(9_000_000) },
                    tasks: { startedAt: iso(9_000_000), completedAt: iso(8_400_000) },
                    implement: { startedAt: iso(8_400_000), completedAt: iso(3_600_000) },
                },
                transitions: [
                    { step: 'specify', substep: 'writing-spec', from: null, by: 'cli', at: iso(10_700_000) },
                    { step: 'plan', substep: 'design', from: { step: 'specify', substep: null }, by: 'cli', at: iso(10_000_000) },
                    { step: 'tasks', substep: 'breakdown', from: { step: 'plan', substep: null }, by: 'cli', at: iso(8_800_000) },
                    { step: 'implement', substep: 'phase1', from: { step: 'tasks', substep: null }, by: 'cli', at: iso(8_200_000) },
                ],
            })}
        />
    ),
};

// ── Per-substep timing ────────────────────────────────
// A single phase whose stepHistory carries tracked `substeps`,
// each with distinct startedAt/completedAt. Every substep row
// should render its own real duration (not just an offset),
// because tracked substeps carry both timestamps.

export const PerSubstepTiming: Story = {
    name: 'Per-substep timing (tracked durations)',
    render: () => (
        <PhasesCard
            state={baseState({
                status: 'planning',
                activeStep: 'plan',
                stepHistory: {
                    plan: {
                        startedAt: iso(600_000),
                        completedAt: iso(120_000),
                        substeps: [
                            { name: 'research', startedAt: iso(590_000), completedAt: iso(450_000) },
                            { name: 'design', startedAt: iso(450_000), completedAt: iso(240_000) },
                            { name: 'data-model', startedAt: iso(240_000), completedAt: iso(120_000) },
                        ],
                    },
                },
                transitions: [
                    { step: 'plan', substep: 'research', from: null, by: 'cli', at: iso(590_000) },
                    { step: 'plan', substep: 'design', from: { step: 'plan', substep: 'research' }, by: 'cli', at: iso(450_000) },
                    { step: 'plan', substep: 'data-model', from: { step: 'plan', substep: 'design' }, by: 'cli', at: iso(240_000) },
                ],
            })}
        />
    ),
};

// ── Duplicate-row collapse ────────────────────────────
// An `implement` phase whose transitions repeat the same substep
// name (`phase1` ×4) interspersed-then-followed by a distinct
// `code-review`. After sort, the four `phase1` events are
// consecutive and collapse to a single `phase1` row; `code-review`
// remains its own row. Expect exactly two substep rows.

export const DuplicateRowCollapse: Story = {
    name: 'Duplicate-row collapse (phase1 ×4 → 1 row)',
    render: () => (
        <PhasesCard
            state={baseState({
                status: 'implementing',
                activeStep: 'implement',
                stepHistory: {
                    implement: { startedAt: iso(600_000), completedAt: null },
                },
                transitions: [
                    { step: 'implement', substep: 'phase1', from: null, by: 'cli', at: iso(590_000) },
                    { step: 'implement', substep: 'phase1', from: { step: 'implement', substep: 'phase1' }, by: 'cli', at: iso(540_000) },
                    { step: 'implement', substep: 'phase1', from: { step: 'implement', substep: 'phase1' }, by: 'cli', at: iso(480_000) },
                    { step: 'implement', substep: 'phase1', from: { step: 'implement', substep: 'phase1' }, by: 'cli', at: iso(420_000) },
                    { step: 'implement', substep: 'code-review', from: { step: 'implement', substep: 'phase1' }, by: 'cli', at: iso(120_000) },
                ],
            })}
        />
    ),
};

// ── Author-at-start ───────────────────────────────────
// Multiple substeps authored by the same actor (`cli`). The actor
// badge must appear exactly once — in the card header, driven by
// the first transition's `by` — and NOT repeated per substep row.

export const AuthorAtStartOnly: Story = {
    name: 'Author badge at start only (not per row)',
    render: () => (
        <PhasesCard
            state={baseState({
                status: 'specifying',
                activeStep: 'specify',
                stepHistory: {
                    specify: {
                        startedAt: iso(300_000),
                        completedAt: null,
                        substeps: [
                            { name: 'parsing', startedAt: iso(290_000), completedAt: iso(250_000) },
                            { name: 'exploring', startedAt: iso(250_000), completedAt: iso(120_000) },
                            { name: 'writing-spec', startedAt: iso(120_000), completedAt: null },
                        ],
                    },
                },
                transitions: [
                    { step: 'specify', substep: 'parsing', from: null, by: 'cli', at: iso(290_000) },
                    { step: 'specify', substep: 'exploring', from: { step: 'specify', substep: 'parsing' }, by: 'cli', at: iso(250_000) },
                    { step: 'specify', substep: 'writing-spec', from: { step: 'specify', substep: 'exploring' }, by: 'cli', at: iso(120_000) },
                ],
            })}
        />
    ),
};

// ── In-flight "ago" ───────────────────────────────────
// Last phase has completedAt: null. Only that phase shows the
// relative age ("ago"); earlier completed phases do not. The
// overall "Ended" stat reads "in progress".

export const InFlightAgo: Story = {
    name: 'In-flight "ago" + overall in progress',
    render: () => (
        <PhasesCard
            state={baseState({
                status: 'implementing',
                activeStep: 'implement',
                stepHistory: {
                    specify: { startedAt: iso(7_200_000), completedAt: iso(6_900_000) },
                    plan: { startedAt: iso(6_900_000), completedAt: iso(6_300_000) },
                    tasks: { startedAt: iso(6_300_000), completedAt: iso(6_000_000) },
                    implement: { startedAt: iso(600_000), completedAt: null },
                },
                transitions: [
                    { step: 'specify', substep: 'writing-spec', from: null, by: 'cli', at: iso(7_100_000) },
                    { step: 'plan', substep: 'design', from: { step: 'specify', substep: null }, by: 'cli', at: iso(6_800_000) },
                    { step: 'tasks', substep: 'breakdown', from: { step: 'plan', substep: null }, by: 'cli', at: iso(6_200_000) },
                    { step: 'implement', substep: 'phase1', from: { step: 'tasks', substep: null }, by: 'cli', at: iso(500_000) },
                ],
            })}
        />
    ),
};

// ── Terminal-finalized completed spec ────────────────────────
// Last phase has a real completedAt (no in-flight anywhere). No
// step renders "so far", no "ago" badge appears, and the overall
// "Ended" stat shows an absolute timestamp rather than "in
// progress".

export const TerminalFinalized: Story = {
    name: 'Terminal finalized (nothing running)',
    render: () => (
        <PhasesCard
            state={baseState({
                status: 'completed',
                activeStep: 'implement',
                stepHistory: {
                    specify: { startedAt: iso(9_000_000), completedAt: iso(8_700_000) },
                    plan: { startedAt: iso(8_700_000), completedAt: iso(8_100_000) },
                    tasks: { startedAt: iso(8_100_000), completedAt: iso(7_800_000) },
                    implement: { startedAt: iso(7_800_000), completedAt: iso(120_000) },
                },
                transitions: [
                    { step: 'specify', substep: 'writing-spec', from: null, by: 'cli', at: iso(8_900_000) },
                    { step: 'implement', substep: 'phase1', from: { step: 'tasks', substep: null }, by: 'cli', at: iso(7_700_000) },
                    { step: 'implement', substep: 'code-review', from: { step: 'implement', substep: 'phase1' }, by: 'cli', at: iso(600_000) },
                ],
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
