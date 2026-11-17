import type { Meta, StoryObj } from '@storybook/preact';
import { MarkdownDoc } from './storyDoc';
// Real lean tasks + the real captured task summaries from spec 327 (companion).
import tasks327 from '../../../../../../specs/327-install-banner-responsive/tasks.md?raw';
import ctx327 from '../../../../../../specs/327-install-banner-responsive/.spec-context.json';

/** Tasks-page renderers in isolation: phase headers, and the capture merge that
 * folds what each task actually did + the files it touched into the checklist. */
const meta: Meta<typeof MarkdownDoc> = {
    title: 'VS Code Extension/Spec Viewer/Markdown Rendering/Tasks/Components',
    component: MarkdownDoc,
};
export default meta;
type Story = StoryObj<typeof MarkdownDoc>;

export const PhaseHeaders: Story = {
    args: {
        md: [
            '## Phase 1: Setup (Shared Infrastructure)',
            '',
            '- [X] **T001** Copy the canonical schema into the runtime path',
            '- [X] **T002** Add the schema fixtures',
            '',
            '## Phase 3: User Story 1 — Trustworthy single status (P1) 🎯 MVP',
            '',
            '- [X] **T010** Implement deriveViewerState',
            '- [ ] **T011** Wire the header badge to ViewerState.status',
        ].join('\n'),
    },
};

export const TaskCapture: Story = {
    name: 'Task Capture (327 · real did/files)',
    args: {
        md: tasks327,
        summaries: (ctx327 as { task_summaries?: Record<string, { did?: string; files?: string[] }> }).task_summaries,
    },
};

export const TaskCaptureEmpty: Story = {
    name: 'Task Capture (no summaries)',
    args: {
        md: [
            '# Tasks',
            '',
            '- [x] **T001** Make `.install-banner` a query container',
            '- [ ] **T002** Add the `@container` rule so the actions stack below the text',
        ].join('\n'),
    },
};

const LEDGER_RUN = [
    '# Tasks: A check says what code it ran on',
    '',
    '## Phase 2: Foundational',
    '',
    'Files: `apps/a/specContext.ts`, `apps/b/model.ts`',
    '',
    '- [x] **T001** [P] [US2] Record `commit` and `tree` on the verification · apps/a/specContext.ts',
    '- [x] **T002** [P] [US2] Export the git runner · apps/b/model.ts',
    '',
    '## Phase 3: User Story 1 - Record the code a check ran on (P1)',
    '',
    '- [x] **T003** [US1] Record the commit after the command runs · apps/c/capture.py',
    '',
    '**Checkpoint**: run checks carry the code they ran on.',
    '',
    '## Phase 4: User Story 2 - See when a check is out of date (P1)',
    '',
    '**Goal**: Someone reading a check can tell the code moved since it ran.',
    '',
    '**Wave 1 — independent (different files):**',
    '',
    '- [x] **T005** [P] [US2] pickVerified passes hex-checked commit · apps/d/stateDerivation.ts',
    '- [x] **T006** [P] [US2] filesChangedSince: tracked diff plus untracked files · apps/d/checkFreshness.ts',
    '',
    '**⟶ Wait for Wave 1 to finish, then:**',
    '',
    '**Wave 2 — independent (different files):**',
    '',
    '- [ ] **T009** [P] [US2] Enrichment: one git round per distinct tree, then mark stale checks in the provider so the viewer never shows a stale one as current · apps/d/provider.ts',
    '- [ ] **T010** [P] [US2] Tests for filesChangedSince — done when the suite passes · apps/d/checkFreshness.test.ts',
    '- [ ] **T011** [P] [US2] Story with a stale check, waits on T009 ⛔ · apps/d/Activity.stories.tsx',
    '',
    '**Checkpoint**: a check followed by a code edit reads out of date.',
    '',
    '## Phase 5: Polish',
    '',
    '- [ ] **T014** Rebuild the canvas vendor copy',
    '',
    '## Dependencies & Execution Order',
    '',
    '- Foundational → Phase 3 and Phase 4 (disjoint) → Polish.',
    '- Phase 4: Wave 1 blocks Wave 2.',
].join('\n');

export const LedgerMidRun: Story = {
    name: 'Ledger · mid-run (T009 running)',
    args: { md: LEDGER_RUN, currentTask: 'T009' },
};

export const LedgerNarrow: Story = {
    name: 'Ledger · 420px',
    args: { md: LEDGER_RUN, currentTask: 'T009', width: 420 },
};

export const LedgerStock: Story = {
    name: 'Ledger · stock spec-kit (no run record)',
    args: { md: '# Tasks: Pager\n\n## Phase 1: Setup ✅\n\n- [x] T001 Add `which` crate to Cargo.toml\n- [x] T002 [P] Create pager module in `src/pager/mod.rs`\n\n## Phase 2: User Story 1 - Configure pager (P1)\n\n**Goal**: Users can configure a pager.\n\n- [x] T003 [US1] Add PagerConfig in src/pager/config.rs\n- [ ] T004 [US1] Select pager from configuration in src/pager/selection.rs\n\n**Checkpoint**: pager is selectable' },
};
