/**
 * Storybook coverage for the Activity panel — the multi-card view that
 * surfaces .spec-context.json data (transitions, task summaries, etc.).
 *
 * Each story drives the panel directly via the `viewerState` signal it
 * reads at render time. The legacy-shape story is the regression
 * fixture for spec 095 — it loads the shape AI writers produced in the
 * wild (a plain `concerns: "None"` string) and proves the panel no
 * longer blanks out.
 */

import type { Meta, StoryObj } from '@storybook/preact';
import { ActivityPanel } from './ActivityPanel';
import { ActivityErrorBoundary } from './ActivityErrorBoundary';
import { viewerState } from '../signals';
import type { ViewerState, TaskSummary, Transition } from '../types';
import legacyFixture from '../../../../specs/095-fix-tasks-card-concerns/fixtures/legacy-string-concerns.spec-context.json';

const meta: Meta<typeof ActivityPanel> = {
    title: 'Viewer/Activity/ActivityPanel',
    component: ActivityPanel,
    decorators: [
        (Story) => (
            <div style="max-width: 720px; padding: 16px; background: var(--vscode-editor-background, #1e1e1e); color: var(--vscode-foreground, #cccccc);">
                <Story />
            </div>
        ),
    ],
};
export default meta;

type Story = StoryObj<typeof ActivityPanel>;

const NOW = Date.now();
const iso = (offsetMs: number) => new Date(NOW - offsetMs).toISOString();

const baseState = (overrides: Partial<ViewerState>): ViewerState => ({
    status: 'implementing',
    activeStep: 'implement',
    steps: {},
    pulse: null,
    highlights: [],
    activeSubstep: null,
    footer: [],
    transitions: [],
    stepHistory: {},
    ...overrides,
});

// ── 1. Empty state ─────────────────────────────────────────────
// No data anywhere — confirms `hasAnyData` short-circuits to the
// "No activity recorded yet" empty state.

export const Empty: Story = {
    name: 'Empty — no activity yet',
    render: () => {
        viewerState.value = baseState({ status: 'draft', activeStep: 'specify' });
        return <ActivityPanel />;
    },
};

// ── 2. Canonical happy path ────────────────────────────────────
// Both `concerns` and `files` are proper string[] from the start.
// Renders Phases + Tasks (with a concerns bullet list under T002).

export const Canonical: Story = {
    name: 'Canonical string[] concerns + files',
    render: () => {
        const taskSummaries: Record<string, TaskSummary> = {
            T001: {
                status: 'DONE',
                did: 'Wired the new auth middleware into the request pipeline',
                files: ['src/middleware/auth.ts', 'src/server.ts'],
                concerns: [],
            },
            T002: {
                status: 'DONE_WITH_CONCERNS',
                did: 'Migrated session-storage from cookies to JWT',
                files: ['src/auth/session.ts'],
                concerns: ['Old cookie format remains readable until next deploy'],
            },
        };
        const transitions: Transition[] = [
            { step: 'specify', substep: null, from: null as unknown as Transition['from'], by: 'extension', at: iso(900_000) },
            { step: 'plan', substep: null, from: { step: 'specify', substep: null }, by: 'extension', at: iso(720_000) },
            { step: 'implement', substep: null, from: { step: 'plan', substep: null }, by: 'extension', at: iso(300_000) },
        ];
        viewerState.value = baseState({
            transitions,
            stepHistory: {
                specify: { startedAt: iso(900_000), completedAt: iso(720_000) },
                plan: { startedAt: iso(720_000), completedAt: iso(300_000) },
                implement: { startedAt: iso(300_000), completedAt: null },
            },
            taskSummaries,
        });
        return <ActivityPanel />;
    },
};

// ── 3. Legacy-shape regression (spec 095) ──────────────────────
// Loads the bundled `legacy-string-concerns.spec-context.json`
// fixture. Before this fix the panel blanked out — `t.concerns.map()`
// threw because the AI wrote `concerns: "None"` as a plain string.
// After the fix, `toStringArray` coerces "None" → [] (omit the bullet
// list) and substantive strings → single-entry arrays.

export const LegacyStringConcerns: Story = {
    name: 'Legacy — concerns as plain strings (spec 095 fixture)',
    render: () => {
        const taskSummaries = legacyFixture.task_summaries as unknown as Record<string, TaskSummary>;
        const transitions = legacyFixture.transitions as unknown as Transition[];
        viewerState.value = baseState({
            status: 'implementing',
            activeStep: 'implement',
            taskSummaries,
            transitions,
            stepHistory: {
                specify: { startedAt: '2026-04-12T18:02:07Z', completedAt: '2026-04-12T18:15:05.479Z' },
                plan: { startedAt: '2026-04-12T18:15:05.479Z', completedAt: '2026-04-12T18:23:23Z' },
                implement: { startedAt: '2026-04-12T18:23:23Z', completedAt: null },
            },
        });
        return <ActivityPanel />;
    },
};

// ── 4. Mixed shapes torture test ───────────────────────────────
// Every shape the AI has been observed to emit, side by side. The
// panel must render each row without throwing; the bullet list
// appears only where the shape resolves to a non-empty string[].

export const MixedShapes: Story = {
    name: 'Mixed shapes — string, [], "None", undefined, number',
    render: () => {
        const taskSummaries = {
            T001: {
                status: 'DONE',
                did: 'concerns is a proper string[]',
                files: ['a.ts', 'b.ts'],
                concerns: ['first concern', 'second concern'],
            },
            T002: {
                status: 'DONE',
                did: 'concerns is the string "None"',
                files: ['c.ts'],
                concerns: 'None',
            },
            T003: {
                status: 'DONE',
                did: 'concerns is a substantive string sentence',
                files: 'single/file/as/string.ts',
                concerns: 'Preview pane still tracked under a separate ticket',
            },
            T004: {
                status: 'DONE',
                did: 'concerns is undefined (key omitted)',
                files: [],
            },
            T005: {
                status: 'reverted',
                did: 'concerns is a number — non-canonical status too',
                files: [],
                concerns: 42,
            },
        } as unknown as Record<string, TaskSummary>;
        viewerState.value = baseState({ taskSummaries });
        return <ActivityPanel />;
    },
};

// ── 5. Error boundary fallback ─────────────────────────────────
// Wraps a throwing component in the boundary to prove one bad card
// can't blank the whole panel. The boundary catches the throw and
// renders the inline notice; sibling rendering elsewhere keeps
// working.

function ThrowingBomb() {
    throw new Error('Synthetic render failure for the Storybook demo');
}

export const ErrorBoundaryFallback: Story = {
    name: 'Error boundary — caught failure',
    render: () => (
        <ActivityErrorBoundary>
            <ThrowingBomb />
        </ActivityErrorBoundary>
    ),
};
