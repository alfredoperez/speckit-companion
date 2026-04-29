# Tasks: Per-Spec Timeline View

**Plan**: [plan.md](./plan.md) | **Date**: 2026-04-28

## Format

- `[P]` marks tasks that can run in parallel with adjacent `[P]` tasks.
- Consecutive `[P]` tasks form a **parallel group** — `/sdd:implement` spawns them as concurrent subagents.
- Tasks without `[P]` are **gates**: they start only after all prior tasks complete.
- Two tasks that touch the same file are never both `[P]`.

---

## Phase 1: Core Implementation

- [x] **T001** Widen `TransitionBy` to include on-disk literals — `src/core/types/specContext.ts` | NFR001
  - **Do**: Change `export type TransitionBy = 'extension' | 'user' | 'cli';` to `export type TransitionBy = 'extension' | 'user' | 'cli' | 'sdd' | 'ai';`. Leave the reader's defensive preservation of unknown values untouched.
  - **Verify**: `npm run compile` passes; grep for narrow `switch` / `if` on `by` shows no consumers that need a new branch.
  - **Leverage**: `src/core/types/specContext.ts` (existing `Transition` type — only the `by` literal union changes).

- [x] **T002** [P] *(depends on T001)* Add `transitions` to extension `ViewerState` — `src/features/spec-viewer/types.ts` | R001, R002
  - **Do**: Import `Transition` from `core/types/specContext`. Add `transitions: Transition[];` to `ViewerState` and to the `contentUpdated` payload type in `ExtensionToViewerMessage`.
  - **Verify**: `npm run compile` passes (downstream errors are expected and fixed by T006).

- [x] **T003** [P] *(depends on T001)* Mirror `transitions` in webview `ViewerState` — `webview/src/spec-viewer/types.ts` | R001, R002
  - **Do**: Add a webview-local `Transition` type (or import the shared one if the webview tsconfig allows) and add `transitions: Transition[];` to the webview's `ViewerState` mirror.
  - **Verify**: webview tsc passes.

- [x] **T004** [P] Create `relativeTime` helper — `webview/src/spec-viewer/relativeTime.ts` | R003
  - **Do**: Export `formatRelativeTime(iso: string, now?: Date): string` returning `"just now"` (<60s), `"Xm ago"` (<60min), `"Xh ago"` (<24h), `"Xd ago"` (>=1d). Round down. Guard against invalid ISO with `"unknown"` fallback.
  - **Verify**: `npm run compile` passes; T008 covers behavior.
  - **Leverage**: NOT `webview/src/spec-viewer/elapsedFormat.ts` — that one formats live elapsed timers; this is a separate file per plan.

- [x] **T005** [P] Create timeline stylesheet — `webview/styles/spec-viewer/_timeline.css` | NFR002, R007, R009, R010
  - **Do**: Vertical-rail layout with a left gutter line; `.timeline-step-group` heading + indented `.timeline-entry` rows; `.timeline-actor-badge` variants (`.is-extension`, `.is-cli`, `.is-sdd`, `.is-ai`, `.is-user`); empty-state class; all colors/borders use `--vscode-*` tokens (no hex).
  - **Verify**: stylesheet parses; visual check deferred to T015.
  - **Leverage**: `webview/styles/spec-viewer/_navigation.css` (theme token usage and step-color CSS variables).

- [x] **T006** *(depends on T002)* Populate `viewerState.transitions` — `src/features/spec-viewer/stateDerivation.ts` | R001, NFR001
  - **Do**: In `deriveViewerState`, copy `specContext?.transitions ?? []` into the returned `ViewerState`. Preserve order — never reverse or sort.
  - **Verify**: `npm run compile` clears the T002 ripple errors; T007 covers behavior.
  - **Leverage**: existing reader call already in `stateDerivation.ts`.

- [x] **T007** [P] *(depends on T006)* Extension test for transitions in viewer state — `src/features/spec-viewer/__tests__/transitionsViewerState.test.ts` | R001, R005, R006
  - **Do**: Add Jest cases: (a) populated `transitions` array is copied verbatim and order-preserving, (b) missing `transitions` defaults to `[]`, (c) `transitions: []` returns `[]`.
  - **Verify**: `npm test -- transitionsViewerState` passes.
  - **Leverage**: `src/features/spec-viewer/__tests__/` existing test patterns (mock `SpecContext`).

- [x] **T008** [P] *(depends on T004)* Tests for `relativeTime` — `webview/src/spec-viewer/__tests__/relativeTime.test.ts` | R003
  - **Do**: Bucket-boundary cases — `<60s → "just now"`, `60s → "1m ago"`, `3599s → "59m ago"`, `3600s → "1h ago"`, `23h59m → "23h ago"`, `24h → "1d ago"`, `7d → "7d ago"`. Pin `now` argument so tests are deterministic.
  - **Verify**: `npm test -- relativeTime` passes.

- [x] **T009** [P] *(depends on T003, T004)* Create `TimelineEntry` row — `webview/src/spec-viewer/components/TimelineEntry.tsx` | R002, R003, R010
  - **Do**: Preact component `<TimelineEntry transition={Transition} />`. Renders step pill, optional substep label, actor badge (class derived from `by`), and a `<time>` element with text from `formatRelativeTime` and `title={iso}` for hover absolute (R003).
  - **Verify**: webview tsc passes; component renders for unit/manual check.
  - **Leverage**: `webview/src/spec-viewer/components/StepBadge.tsx` (or equivalent existing badge component) for step color/icon parity (R007).

- [x] **T010** [P] *(depends on T003)* Add timeline signals — `webview/src/spec-viewer/signals.ts` | R001, R004
  - **Do**: Import `signal` and `Transition`. Add `export const timelineVisible = signal(false);` and `export const transitions = signal<Transition[]>([]);`.
  - **Verify**: webview tsc passes.

- [x] **T011** [P] *(depends on T005)* Import `_timeline.css` — `webview/styles/spec-viewer/index.css` | NFR002
  - **Do**: Add `@import './_timeline.css';` next to the existing partials, alphabetically or grouped with the panel-level imports.
  - **Verify**: webpack bundle includes the rules (visual check after T015).

- [x] **T012** [P] *(depends on T006)* Add `refreshContextIfDisplaying` to provider — `src/features/spec-viewer/specViewerProvider.ts` | R008, NFR004
  - **Do**: New method `refreshContextIfDisplaying(specContextPath: string): void`. If the active panel's spec dir matches `path.dirname(specContextPath)`, re-read context, re-derive `viewerState`, and `postMessage({ type: 'contentUpdated', viewerState })`. Do not touch markdown.
  - **Verify**: `npm run compile` passes; manual scenario covered by T016 wiring.
  - **Leverage**: existing `refreshIfDisplaying` shape — copy the panel-active check, swap the body to context-only.

- [x] **T013** [P] *(depends on T009)* Create `TimelinePanel` — `webview/src/spec-viewer/components/TimelinePanel.tsx` | R001, R005, R006, R009
  - **Do**: Preact component reading `transitions.value`. If empty, render `<div class="timeline-empty">No transitions recorded yet</div>` (R006). Otherwise group consecutive entries with the same `step` under a single `<section class="timeline-step-group">` heading (R009) and render each entry via `<TimelineEntry />` in original order (R005, oldest-first).
  - **Verify**: webview tsc passes; visual check deferred to T017.

- [x] **T014** [P] *(depends on T010)* Wire `transitions` signal on update — `webview/src/spec-viewer/index.tsx` | R001, R008
  - **Do**: In the `contentUpdated` message handler, after applying the existing viewerState fields, set `transitions.value = msg.viewerState.transitions ?? []`.
  - **Verify**: webview tsc passes.

- [x] **T015** [P] *(depends on T010)* Add Timeline toggle to nav bar — `webview/src/spec-viewer/components/NavigationBar.tsx` | R004
  - **Do**: At the right end of `.nav-primary`, add a button that flips `timelineVisible.value`. Use the same active-state ring/styling the current step tab uses. `aria-pressed={timelineVisible.value}`.
  - **Verify**: webview tsc passes; button visible after T017 ties App together.
  - **Leverage**: existing step-tab button render in `NavigationBar.tsx`.

- [x] **T016** [P] *(depends on T012)* Wire watcher to refresh viewer — `src/core/fileWatchers.ts` | R008, NFR004
  - **Do**: In `handleSpecContextChange`, after the existing `specExplorer.refresh()` call, also call `specViewerProvider.refreshContextIfDisplaying(uri.fsPath)`. Reuse the existing watcher event — no new watcher, no polling.
  - **Verify**: `npm run compile` passes; live-update scenario from spec passes manually after T017.

- [x] **T017** *(depends on T013, T014, T015, T016)* Render `TimelinePanel` in App — `webview/src/spec-viewer/App.tsx` | R004, NFR003
  - **Do**: Render `<TimelinePanel />` when `timelineVisible.value === true`. Keep the markdown pane mounted but hide it via the `hidden` attribute so toggling back is instant; defer first `<TimelinePanel />` mount until the toggle is clicked (NFR003).
  - **Verify**: `npm run compile` and webview build both pass; press F5, open a spec, click Timeline — entries render, hover shows absolute timestamp, an external `.spec-context.json` write appends a row without reload, empty-transitions spec shows the empty state.

- [x] **T018** [P] *(depends on T017)* Document Timeline toggle — `README.md`
  - **Do**: Add a short subsection under "Reading Specs" describing the Timeline toggle (where it lives, what it shows, how it updates). Per CLAUDE.md feature → README map: new webview UI element.
  - **Verify**: `git diff README.md` shows the new subsection; cross-link from the relevant table row if applicable.

- [x] **T019** [P] *(depends on T017)* Document timeline panel state — `docs/viewer-states.md`
  - **Do**: Add the Timeline panel state and its toggle interaction (entry/exit, what overrides what, what it does on empty transitions). Per CLAUDE.md: viewer-states changes belong here.
  - **Verify**: `git diff docs/viewer-states.md` shows the new section.
