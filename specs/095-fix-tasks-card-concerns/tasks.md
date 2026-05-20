# Tasks: Fix Tasks Card Concerns Crash

**Plan**: [plan.md](./plan.md)

> Format reference: `[P]` markers and parallel groups — see `skills/tasks/SKILL.md` § Phase rules.

## Phase 1: Core Implementation

- [x] **T001** [P] Add FIRM-11132 fixture — `specs/095-fix-tasks-card-concerns/fixtures/firm-11132.spec-context.json` | R006
  - **Do**: Reconstruct the final on-disk `.spec-context.json` from the FIRM-11132 bundle (verbatim from `mutations.md` 1+8+9+10 + extension-injected transitions): `workflow: "sdd"`, `currentStep: "implement"`, `status: "implementing"`, `branch: "feature/FIRM-11132"`, the 8-entry transitions array (specify→plan→plan-research→plan-design→plan→implement→implement-scope-correction), and the 7-entry `task_summaries` (T001–T004 string, hyphenated T001-T004 rollup, RT1, RT2, RT3) with `concerns` as plain strings exactly as the AI wrote them. This is the canonical regression fixture both new tests load.
  - **Verify**: `JSON.parse` of the file succeeds; `task_summaries.T001.concerns` is the literal string `"None — to-rem() matches the file's own precedent; SASS imports already correct"`.
  - **Leverage**: bundle at `/Users/alfredoperez/dev/GitHub/obsidian-vault/Projects/speckit companion/FIRM-11132-bundle/spec-context-history/mutations.md`.

- [x] **T002** [P] Add `toStringArray` guard in TasksCard — `webview/src/spec-viewer/components/cards/TasksCard.tsx` | R001
  - **Do**: Add a module-local `toStringArray(value: unknown): string[]` helper that returns `value` if `Array.isArray(value)`; returns `[]` for `null`/`undefined`/empty string/`"none"`/`"n/a"` (case-insensitive, trimmed); returns `[String(value).trim()]` for any other primitive. Replace the `t.concerns && t.concerns.length > 0` guard at lines 74–80 and the `t.files && t.files.length > 0` guard at lines 59–73 to call the helper. Iterate the helper's return for `.map()`; the existing `length > 0` empty-check becomes `arr.length > 0` against the coerced array.
  - **Verify**: `npm run compile` passes; manually feeding a string `"None"` no longer renders the `<ul class="task-row__concerns">` block; feeding `"real concern text"` renders one `<li>`.
  - **Leverage**: pattern from `src/features/spec-viewer/stateDerivation.ts::pickStringArray`.

- [x] **T003** [P] Coerce task_summaries shapes in normalizeSpecContext — `src/features/specs/specContextReader.ts` | R002, R003
  - **Do**: Extend `normalizeSpecContext` to walk `raw.task_summaries` (if present and object) once; for each entry coerce `.concerns` and `.files` using the same rules as T002's helper (array passthrough, "none"/"n/a"/empty string → `[]`, other string → `[trimmed]`, other type → omit the field). Preserve all other keys on each entry untouched (FR-013 unknown-field preservation). Do **not** deep-clone the SpecContext — mutate inside a fresh `task_summaries` object only when at least one entry needs coercion (NFR001).
  - **Verify**: `npm test -- specContextReader` passes after T008 lands; eyeballing: feeding `{ task_summaries: { T001: { concerns: "None" } } }` returns `{ task_summaries: { T001: { concerns: [] } } }`.
  - **Leverage**: existing coercion helpers in same file (`coerceStatus`, `coerceCurrentStep`).

- [x] **T004** [P] Tighten TASK SUMMARIES directive — `src/ai-providers/promptBuilder.ts` | R004
  - **Do**: Replace the two-line `TASK SUMMARIES` entry in `SHARED_RULES` (current lines 43–44) with explicit shape guidance:
    ```
    TASK SUMMARIES (implement only): after each task, append task_summaries.<TaskID> = { status, did, files, concerns }.
    Shapes: status is "DONE" or "DONE_WITH_CONCERNS"; did is one sentence; files is string[]; concerns is string[] (omit the key entirely when empty — never write "None" or "N/A").
    The viewer reads these.
    ```
  - **Verify**: `npm run compile` passes; `promptBuilder.test.ts` snapshot/assertion update in T009 confirms the new text is emitted.
  - **Leverage**: same `SHARED_RULES` block already documents `stepHistory is READ-ONLY` similarly.

- [x] **T005** [P] Create ActivityErrorBoundary — `webview/src/spec-viewer/components/ActivityErrorBoundary.tsx` | R005, NFR002
  - **Do**: Preact class component with `componentDidCatch(error, info)` that posts `{ type: 'webviewError', source: 'activity-panel', message: String(error), stack: error.stack }` via `vscode.postMessage` and renders a quiet inline notice (`<div class="activity-error">Activity panel hit an error — see the SpecKit Companion output channel.</div>`) when state.hasError. Otherwise renders `props.children`.
  - **Verify**: `npm run compile` passes; forcing a throw in a child (via test double in T007) shows the inline notice without crashing the panel root.
  - **Leverage**: Preact `Component` class shape — there are no existing error boundaries in this repo, so this file establishes the pattern.

- [x] **T006** Wire boundary into App — `webview/src/spec-viewer/App.tsx` *(depends on T005)* | R005
  - **Do**: Import `ActivityErrorBoundary` and wrap the existing `<ActivityPanel />` JSX at `App.tsx:54` in `<ActivityErrorBoundary>...</ActivityErrorBoundary>`. No layout change, no new state, no other components touched.
  - **Verify**: `npm run compile` passes; webview still renders normally in dev mode (`npm run watch` + F5).
  - **Leverage**: existing JSX structure in `App.tsx` lines 38–61.

- [x] **T007** [P] TasksCard render tests — `webview/src/spec-viewer/components/cards/__tests__/TasksCard.test.tsx` *(depends on T001, T002)* | R001, R006
  - **Do**: New test file covering the four shapes from spec scenarios: `concerns: []`, `concerns: ["a","b"]`, `concerns: "real concern text"`, `concerns: "None"`. Plus a "mixed across summaries" test that imports the FIRM-11132 fixture from T001 and renders the whole `task_summaries` block, asserting 7 task rows render and zero `.map()` errors propagate. Also force-throw a `ThrowingCard` test-double rendered inside `<ActivityErrorBoundary>` (from T005) to verify the boundary contains the failure to one card.
  - **Verify**: `npm test -- TasksCard` passes; no `TypeError: .map is not a function` in test output.
  - **Leverage**: webview test setup — check `webview/src/spec-viewer/__tests__/relativeTime.test.ts` and `markdown/inline.test.ts` for the existing Jest config and import patterns.

- [x] **T008** [P] specContextReader normalization tests — `src/features/specs/__tests__/specContextReader.test.ts` *(depends on T001, T003)* | R002, R006
  - **Do**: New test file. One `describe` block for `normalizeSpecContext.task_summaries`: cases per R002 rule (array passthrough, `"none"`/`"n/a"`/empty → `[]`, arbitrary string → `[trimmed]`, `null`/`undefined`/number → field omitted, mixed across multiple task entries). One regression test that reads the FIRM-11132 fixture from T001 through `readSpecContext` (or `normalizeSpecContext` directly with the parsed JSON) and asserts every `task_summaries[*].concerns` is `string[]` afterwards.
  - **Verify**: `npm test -- specContextReader` passes.
  - **Leverage**: `src/features/specs/__tests__/specContextReconciler.test.ts` for the file structure and how it imports from `../specContextReader`-adjacent modules.

- [x] **T009** [P] Update promptBuilder snapshot — `src/ai-providers/__tests__/promptBuilder.test.ts` *(depends on T004)* | R004
  - **Do**: Update the existing assertions to match the new directive text from T004. Add one positive assertion that the emitted block contains the substring `concerns is string[]` (or whatever exact phrasing T004 commits to) so future drift fails loudly.
  - **Verify**: `npm test -- promptBuilder` passes.
  - **Leverage**: existing `toContain` assertions at `src/ai-providers/__tests__/promptBuilder.test.ts:27-28` and `:113`.
