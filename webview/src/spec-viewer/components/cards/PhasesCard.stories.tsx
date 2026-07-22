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
    timing: { measuredPhases: 0, expectedPhases: 4, complete: false },
    ...overrides,
});

const trusted = (start: string, end: string) => ({
    startedAt: start,
    completedAt: end,
    durationTrusted: true,
});

// ── Overall stats only ───────────────────────────────────────
// Completed run whose timing totals are known (started / elapsed /
// ended). No per-phase substeps were recorded, so the card shows
// only the overall block. The compact coverage line and phase strip
// now live solely in the Overview, not here.

export const OverallStatsOnly: Story = {
    name: 'Overall stats — complete run',
    render: () => (
        <PhasesCard state={baseState({
            status: 'completed',
            stepHistory: {
                specify: trusted('2026-07-02T10:00:00Z', '2026-07-02T10:05:00Z'),
                plan: trusted('2026-07-02T10:05:00Z', '2026-07-02T10:12:00Z'),
                tasks: trusted('2026-07-02T10:12:00Z', '2026-07-02T10:15:00Z'),
                implement: trusted('2026-07-02T10:15:00Z', '2026-07-02T10:24:00Z'),
            },
            timing: {
                measuredPhases: 4,
                expectedPhases: 4,
                complete: true,
                startedAt: '2026-07-02T10:00:00Z',
                endedAt: '2026-07-02T10:24:00Z',
                elapsedMs: 1_440_000,
            },
        })} />
    ),
};

// ── Overall stats + per-phase events ─────────────────────────
// A completed run whose implement phase carries recorded substeps.
// Both unique blocks render: the Started / Elapsed / Ended overall
// stats and the grouped per-phase event timeline.

export const OverallStatsWithEvents: Story = {
    name: 'Overall stats + per-phase events',
    render: () => (
        <PhasesCard state={baseState({
            status: 'completed',
            stepHistory: {
                specify: trusted('2026-07-02T10:00:00Z', '2026-07-02T10:05:00Z'),
                plan: trusted('2026-07-02T10:05:00Z', '2026-07-02T10:12:00Z'),
                tasks: trusted('2026-07-02T10:12:00Z', '2026-07-02T10:15:00Z'),
                implement: {
                    ...trusted('2026-07-02T10:15:00Z', '2026-07-02T10:24:00Z'),
                    substeps: [
                        { name: 'phase1', startedAt: '2026-07-02T10:15:00Z', completedAt: '2026-07-02T10:20:00Z' },
                        { name: 'code-review', startedAt: '2026-07-02T10:20:00Z', completedAt: '2026-07-02T10:24:00Z' },
                    ],
                },
            },
            timing: {
                measuredPhases: 4,
                expectedPhases: 4,
                complete: true,
                startedAt: '2026-07-02T10:00:00Z',
                endedAt: '2026-07-02T10:24:00Z',
                elapsedMs: 1_440_000,
            },
        })} />
    ),
};

// ── Events only (in flight, no totals) ───────────────────────
// A run still in flight — no completed timing totals — but the live
// specify phase has recorded substeps. The overall block is absent;
// only the per-phase event timeline renders.

export const EventsOnlyInFlight: Story = {
    name: 'Events only — in flight (no totals)',
    render: () => (
        <PhasesCard state={baseState({
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
        })} />
    ),
};

// ── Author-at-start ───────────────────────────────────
// Multiple substeps authored by the same actor (`cli`). The actor
// badge must appear exactly once — in the card header, driven by
// the first history entry's `by` — and NOT repeated per substep row.

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
                history: [
                    { step: 'specify', substep: 'parsing', from: null, by: 'cli', at: iso(290_000) },
                    { step: 'specify', substep: 'exploring', from: { step: 'specify', substep: 'parsing' }, by: 'cli', at: iso(250_000) },
                    { step: 'specify', substep: 'writing-spec', from: { step: 'specify', substep: 'exploring' }, by: 'cli', at: iso(120_000) },
                ],
            })}
        />
    ),
};

// ── Empty collapses to null ──────────────────────────────────
// The card has phases in stepHistory but nothing unique to show —
// no completed timing totals and no recorded per-phase events. With
// the redundant strip gone, the card must render nothing rather than
// an empty shell.

export const EmptyCollapsesToNull: Story = {
    name: 'Empty — collapses to null (no totals, no events)',
    render: () => (
        <div>
            <p style="opacity: 0.6; font-style: italic;">
                Phases exist but there are no timing totals and no events — nothing renders below this line:
            </p>
            <PhasesCard state={baseState({
                status: 'planning',
                stepHistory: {
                    specify: { startedAt: '2026-07-02T10:00:00Z', completedAt: '2026-07-02T10:05:00Z', durationTrusted: false },
                    plan: { startedAt: '2026-07-02T10:05:00Z', completedAt: null, durationTrusted: false },
                },
            })} />
        </div>
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
