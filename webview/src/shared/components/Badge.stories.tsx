import type { Meta, StoryObj } from '@storybook/preact';
import { Badge } from './Badge';

const meta: Meta<typeof Badge> = {
    title: 'Primitives/Badge',
    component: Badge,
};
export default meta;

type Story = StoryObj<typeof Badge>;

// Canonical status labels mirrored from src/features/spec-viewer/phaseCalculation.ts
// (stories can't import from src/, so duplicated here).
const LABELS = {
    draft: 'DRAFT',
    active: 'ACTIVE',
    specifying: 'SPECIFYING...',
    specified: 'SPECIFY COMPLETE',
    planning: 'PLANNING...',
    planned: 'PLAN COMPLETE',
    tasking: 'CREATING TASKS...',
    readyToImplement: 'READY TO IMPLEMENT',
    implementing: 'IMPLEMENTING...',
    tasksDone: 'TASKS DONE',
    completed: 'COMPLETED',
    archived: 'ARCHIVED',
};

// ── Neutral / pre-work ──────────────────────────────────

export const Default: Story = { args: { text: LABELS.active, variant: 'status' } };
export const Active: Story = { args: { text: LABELS.active, variant: 'status', status: 'active' } };
export const Draft: Story = { args: { text: LABELS.draft, variant: 'status', status: 'draft' } };

// ── In-progress (accent tier) ───────────────────────────

export const Specifying: Story = { args: { text: LABELS.specifying, variant: 'status', status: 'specifying' } };
export const Planning: Story = { args: { text: LABELS.planning, variant: 'status', status: 'planning' } };
export const Tasking: Story = { args: { text: LABELS.tasking, variant: 'status', status: 'tasking' } };
export const Implementing: Story = { args: { text: LABELS.implementing, variant: 'status', status: 'implementing' } };

// ── Intermediate done (success-subtle tier) ─────────────

export const Specified: Story = { args: { text: LABELS.specified, variant: 'status', status: 'specified' } };
export const Planned: Story = { args: { text: LABELS.planned, variant: 'status', status: 'planned' } };
export const ReadyToImplement: Story = { args: { text: LABELS.readyToImplement, variant: 'status', status: 'ready-to-implement' } };
export const TasksDone: Story = { args: { text: LABELS.tasksDone, variant: 'status', status: 'tasks-done' } };

// ── Terminal ────────────────────────────────────────────

export const Completed: Story = { args: { text: LABELS.completed, variant: 'status', status: 'completed' } };
export const Archived: Story = { args: { text: LABELS.archived, variant: 'status', status: 'archived' } };

// ── Stale indicator (circle, distinct from pill) ────────

export const Stale: Story = { args: { text: '!', variant: 'stale' } };

// ── All at once, grouped by tier ────────────────────────

export const AllStatuses: Story = {
    render: () => (
        <div style="display: flex; flex-direction: column; gap: 16px; align-items: flex-start;">
            <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                <span style="font-size: 11px; color: var(--text-secondary); min-width: 120px;">Pre-work / neutral</span>
                <Badge text={LABELS.draft} status="draft" />
                <Badge text={LABELS.active} status="active" />
            </div>
            <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                <span style="font-size: 11px; color: var(--text-secondary); min-width: 120px;">In-progress</span>
                <Badge text={LABELS.specifying} status="specifying" />
                <Badge text={LABELS.planning} status="planning" />
                <Badge text={LABELS.tasking} status="tasking" />
                <Badge text={LABELS.implementing} status="implementing" />
            </div>
            <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                <span style="font-size: 11px; color: var(--text-secondary); min-width: 120px;">Intermediate done</span>
                <Badge text={LABELS.specified} status="specified" />
                <Badge text={LABELS.planned} status="planned" />
                <Badge text={LABELS.readyToImplement} status="ready-to-implement" />
                <Badge text={LABELS.tasksDone} status="tasks-done" />
            </div>
            <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                <span style="font-size: 11px; color: var(--text-secondary); min-width: 120px;">Terminal</span>
                <Badge text={LABELS.completed} status="completed" />
                <Badge text={LABELS.archived} status="archived" />
            </div>
            <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                <span style="font-size: 11px; color: var(--text-secondary); min-width: 120px;">Stale indicator</span>
                <Badge text="!" variant="stale" />
            </div>
        </div>
    ),
};
