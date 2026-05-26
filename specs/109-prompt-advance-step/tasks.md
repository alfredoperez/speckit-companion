# Tasks: Prompt Advance Step

**Date**: 2026-05-26

## Phase 1

- [x] **T001** — In `src/ai-providers/promptBuilder.ts`, add a `NEXT_STEP_BY_STEP: Record<PromptStep, PromptStep | null>` map next to `COMPLETED_STATUS_BY_STEP`: `specify → plan`, `plan → tasks`, `tasks → implement`, `implement → null`.
- [x] **T002** — In `renderPreamble`, extend the "MUST DO BEFORE ENDING" block with a `(d)` clause: when `NEXT_STEP_BY_STEP[step]` is non-null, instruct the AI to set `currentStep` to that next step after appending the completion transition; when null (i.e. `implement`), state explicitly that `currentStep` stays on `implement`. Mirror the failure-mode sentence pattern used for clauses (a)/(b)/(c).
- [x] **T003** — In `renderLifecycleBody`, append a single instruction after the existing step-loop bullets: "After completing a step, also set `currentStep` to the next step in `specify → plan → tasks → implement`; after `implement`, leave it on `implement`."
- [x] **T004** — In `src/ai-providers/__tests__/promptBuilder.test.ts`, add a test that iterates `['specify', 'plan', 'tasks']` and asserts the rendered preamble contains both `currentStep` and the expected next step name, plus a separate case for `implement` that asserts the terminal-state phrasing is present.
- [x] **T005** — Add a test that calls `buildLifecyclePrompt` (and a second test for `buildSpecifyCreationPreamble`) and asserts the lifecycle one-liner from T003 appears in the output.
- [x] **T006** — Run `npm run compile && npm test` and confirm the new and existing prompt-builder tests pass.
