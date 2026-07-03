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
import { viewerState, navState } from '../signals';
import type { ViewerState, TaskSummary, Transition, NavState } from '../types';
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

const baseNav = (overrides: Partial<NavState>): NavState => ({
    coreDocs: [],
    relatedDocs: [],
    currentDoc: 'spec',
    workflowPhase: 'implement',
    taskCompletionPercent: 0,
    isViewingRelatedDoc: false,
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

// ── 6. Install banner — slim, shown ────────────────────────────
// The extension is absent and the banner hasn't been dismissed, so
// the slim single-row banner (glyph + one line + Install + Learn
// more + dismiss ×) renders above the activity cards.

export const InstallBannerSlim: Story = {
    name: 'Install banner — slim, shown',
    render: () => {
        navState.value = baseNav({ showInstallPrompt: true });
        viewerState.value = baseState({ status: 'draft', activeStep: 'specify' });
        return <ActivityPanel />;
    },
};

// ── 7. Install banner — dismissed (hidden) ─────────────────────
// The user dismissed the banner, so `showInstallPrompt` is false and
// the banner is absent — only the empty activity state shows.

export const InstallBannerDismissed: Story = {
    name: 'Install banner — dismissed (hidden)',
    render: () => {
        navState.value = baseNav({ showInstallPrompt: false });
        viewerState.value = baseState({ status: 'draft', activeStep: 'specify' });
        return <ActivityPanel />;
    },
};

// ============================================
// Redesign payloads: rich (ICE-complete), mid-pipeline, and the sparse
// legacy shape is already covered by LegacyStringConcerns above.
// ============================================

const richReasoningState: ViewerState = {
    status: 'completed',
    activeStep: 'implement',
    steps: {},
    pulse: null,
    highlights: [],
    activeSubstep: null,
    footer: [],
    history: [],
    stepHistory: {
        specify: { startedAt: '2026-07-02T10:00:00Z', completedAt: '2026-07-02T10:06:00Z', durationTrusted: true },
        plan: { startedAt: '2026-07-02T10:06:00Z', completedAt: '2026-07-02T10:18:00Z', durationTrusted: true },
        tasks: { startedAt: '2026-07-02T10:18:00Z', completedAt: '2026-07-02T10:21:00Z', durationTrusted: true },
        implement: { startedAt: '2026-07-02T10:21:00Z', completedAt: '2026-07-02T10:52:00Z', durationTrusted: true },
    },
    intent: 'Turn the Activity panel from an 11-card scroll into a brief: hero summary, always-visible ICE plan, tabbed detail, and signature data visuals.',
    context: ['area: webview/src/spec-viewer/components', 'constraint: approved A-hybrid mock', 'living spec: none configured'],
    expectations: ['existing cards reused inside tabs', 'tab state in-memory only', 'color encodes state only'],
    approach: 'Three new components recomposing existing cards; signature elements as token-driven CSS and SVG.',
    classification: { projectedFiles: 12, projectedTasks: 11, scopeSignal: 'none', verdict: 'normal' },
    decisions: [
        { decision: 'inline SVG stroke-dasharray donut', why: 'zero dependencies, token-colored', rejected: 'a chart library' },
        { decision: 'tab state as an in-memory signal', why: 'matches the webview reactive idiom', rejected: 'persisting the active tab' },
        { decision: 'hero absorbs PR link, checkpoints, last action', why: 'they are run-status facts, not approach prose', rejected: 'keeping a separate Approach card' },
    ],
    verified: [
        { what: 'full jest suite', command: 'npm test', result: '170 webview tests pass' },
        { what: 'TypeScript compile', command: 'npm run compile', result: 'clean', warnings: ['setTimeout typing differs under ts-jest'] },
    ],
    coverage: [
        { req: 'FR-001', title: 'Hero strip with stat chips', tasks: ['T002', 'T003'], tests: ['activityModels.test.ts::heroStats'] },
        { req: 'FR-002', title: 'Always-visible Plan section (ICE triad)', tasks: ['T004'], tests: [] },
        { req: 'FR-003', title: 'Accessible tab bar with count badges', tasks: ['T001', 'T005'], tests: ['activityModels.test.ts::activityTabs'] },
        { req: 'FR-004', title: 'Default tab: Proof on gaps/concerns', tasks: ['T001'], tests: ['activityModels.test.ts::defaultActivityTab'] },
    ],
    concerns: [{ note: 'codicon glyphs deferred from the design critique' }],
    taskSummaries: {
        T001: { status: 'DONE', did: 'tab model + default rule', files: ['activityTabsModel.ts'] },
        T002: { status: 'DONE', did: 'hero stats derivation', files: ['activityHeroModel.ts'] },
        T003: { status: 'DONE', did: 'ActivityHero component', files: ['ActivityHero.tsx'] },
    },
    prUrl: 'https://github.com/alfredoperez/speckit-companion/pull/402',
    prNumber: 402,
    checkpointStatus: { commit: true, pr: true },
};

// The full redesign with an ICE-complete payload: hero, plan, four tabs.
export const RedesignRich: Story = {
    render: () => {
        viewerState.value = richReasoningState;
        navState.value = { showInstallPrompt: false } as NavState;
        return <div style="max-width: 900px;"><ActivityPanel /></div>;
    },
};

// Mid-pipeline: nothing covered yet, one concern — Proof opens by default.
export const RedesignMidPipeline: Story = {
    render: () => {
        viewerState.value = {
            ...richReasoningState,
            status: 'implementing',
            verified: undefined,
            checkpointStatus: undefined,
            prUrl: undefined,
            prNumber: undefined,
            lastAction: 'T005 in progress — tab bar wiring',
            coverage: richReasoningState.coverage!.map(r => ({ ...r, tests: [] })),
            stepHistory: {
                specify: { startedAt: '2026-07-02T10:00:00Z', completedAt: '2026-07-02T10:06:00Z', durationTrusted: true },
                plan: { startedAt: '2026-07-02T10:06:00Z', completedAt: '2026-07-02T10:18:00Z', durationTrusted: false },
                implement: { startedAt: '2026-07-02T10:21:00Z', completedAt: null, durationTrusted: true },
            },
        };
        navState.value = { showInstallPrompt: false } as NavState;
        return <div style="max-width: 900px;"><ActivityPanel /></div>;
    },
};
