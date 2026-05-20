# Tasks: Fix Tasks Card Concerns Crash

**Plan**: [plan.md](./plan.md)

> Format reference: `[P]` markers and parallel groups — see `skills/tasks/SKILL.md` § Phase rules.

## Phase 1: Core Implementation

- [x] **T001** [P] Add regression fixture — `specs/095-fix-tasks-card-concerns/fixtures/legacy-string-concerns.spec-context.json` | R006
  - **Do**: Capture the crash-inducing `.spec-context.json` shape — `workflow: "sdd"`, `currentStep: "implement"`, `status: "implementing"`, a multi-entry transitions array (specify→plan→plan-research→plan-design→plan→implement→implement-scope-correction), and a `task_summaries` block with 4 entries whose `concerns` are plain strings (mix of `"None"` and substantive sentences). This is the canonical regression fixture both new tests load.
  - **Verify**: `JSON.parse` succeeds; at least one `task_summaries[*].concerns` is a literal `string`.

- [x] **T002** [P] Add `toStringArray` guard in TasksCard — `webview/src/spec-viewer/components/cards/TasksCard.tsx` | R001
  - **Do**: Add a `toStringArray(value: unknown): string[]` helper that returns `value` if `Array.isArray(value)`; returns `[]` for `null`/`undefined`/empty string/`"none"`/`"n/a"` (case-insensitive, trimmed); returns `[String(value).trim()]` for any other primitive. Replace the `t.concerns && t.concerns.length > 0` guard and the `t.files && t.files.length > 0` guard to call the helper. Iterate the helper's return for `.map()`.
  - **Verify**: `npm run compile` passes; feeding a string `"None"` no longer renders the `<ul class="task-row__concerns">` block; feeding `"real concern text"` renders one `<li>`.
  - **Leverage**: pattern from `src/features/spec-viewer/stateDerivation.ts::pickStringArray`.

- [x] **T003** [P] Coerce task_summaries shapes in normalizeSpecContext — `src/features/specs/specContextReader.ts` | R002, R003
  - **Do**: Extend `normalizeSpecContext` to walk `raw.task_summaries` (if present and object) once; for each entry coerce `.concerns` and `.files` using the same rules as T002's helper (array passthrough, "none"/"n/a"/empty string → `[]`, other string → `[trimmed]`, other type → omit the field). Preserve all other keys on each entry untouched (FR-013 unknown-field preservation). Do **not** deep-clone the SpecContext (NFR001).
  - **Verify**: `npm test -- specContextReader` passes after T008 lands.
  - **Leverage**: existing coercion helpers in same file (`coerceStatus`, `coerceCurrentStep`).

- [x] **T004** [P] Tighten TASK SUMMARIES directive — `src/ai-providers/promptBuilder.ts` | R004
  - **Do**: Replace the two-line `TASK SUMMARIES` entry in `SHARED_RULES` with explicit shape guidance — `status` is `"DONE"` or `"DONE_WITH_CONCERNS"`, `did` is one sentence, `files` is `string[]`, `concerns` is `string[]` (omit when empty — never write `"None"`/`"N/A"`).
  - **Verify**: `npm run compile` passes; `promptBuilder.test.ts` snapshot/assertion update in T009 confirms the new text is emitted.
  - **Leverage**: same `SHARED_RULES` block already documents `stepHistory is READ-ONLY` similarly.

- [x] **T005** [P] Create ActivityErrorBoundary — `webview/src/spec-viewer/components/ActivityErrorBoundary.tsx` | R005, NFR002
  - **Do**: Preact class component with `componentDidCatch(error, info)` that posts `{ type: 'webviewError', source: 'activity-panel', message: String(error), stack: error.stack }` via `vscode.postMessage` and renders a quiet inline notice when state.hasError. Otherwise renders `props.children`.
  - **Verify**: `npm run compile` passes; the boundary contains a synthetic throw inside `ActivityErrorBoundary.stories.tsx`.

- [x] **T006** Wire boundary into App — `webview/src/spec-viewer/App.tsx` *(depends on T005)* | R005
  - **Do**: Import `ActivityErrorBoundary` and wrap the existing `<ActivityPanel />` JSX in `<ActivityErrorBoundary>...</ActivityErrorBoundary>`. No layout change.
  - **Verify**: `npm run compile` passes.

- [x] **T007** [P] TasksCard helper tests — `webview/src/spec-viewer/components/cards/__tests__/TasksCard.test.ts` *(depends on T001, T002)* | R001, R006
  - **Do**: New test file covering the four shapes from spec scenarios: `concerns: []`, `concerns: ["a","b"]`, `concerns: "real concern text"`, `concerns: "None"`. Plus a "mixed across summaries" test that imports the bundled fixture from T001 and runs every entry through `toStringArray`.
  - **Verify**: `npm test -- TasksCard` passes; no `TypeError: .map is not a function` in test output.

- [x] **T008** [P] specContextReader normalization tests — `src/features/specs/__tests__/specContextReader.test.ts` *(depends on T001, T003)* | R002, R006
  - **Do**: New test file covering every R002 rule (array passthrough, `"none"`/`"n/a"`/empty → `[]`, arbitrary string → `[trimmed]`, `null`/`undefined`/number → field omitted, mixed across multiple task entries). One regression test reads the bundled fixture through `normalizeSpecContext` and asserts every `task_summaries[*].concerns` is `string[]` afterwards.
  - **Verify**: `npm test -- specContextReader` passes.
  - **Leverage**: `src/features/specs/__tests__/specContextReconciler.test.ts` for the file structure.

- [x] **T009** [P] Update promptBuilder snapshot — `src/ai-providers/__tests__/promptBuilder.test.ts` *(depends on T004)* | R004
  - **Do**: Update assertions to match the new directive text from T004. Add positive assertions for `concerns is string[]`, `files is string[]`, and the `Omit concerns when empty` wording so future drift fails loudly.
  - **Verify**: `npm test -- promptBuilder` passes.
