# Tasks: Fix Analyze Spec-Context Update

**Plan**: [plan.md](./plan.md)

> Format reference: `[P]` markers and parallel groups — see `skills/tasks/SKILL.md` § Phase rules.

## Phase 1: Core Implementation

- [x] **T001** Extend `CANONICAL_SUBSTEPS` with `analyze` and `clarify` — `src/core/types/specContext.ts` | R001, R006
  - **Do**: In the `CANONICAL_SUBSTEPS` record (around line 245), add `analyze: []` and `clarify: []` as entries. Keep them as `readonly string[]` via the existing `as const`. This widens the `PromptStep` type to accept both step names.
  - **Verify**: `npm run compile` — the new keys must compile without breaking the `Record<PromptStep, string>` lookup tables in `promptBuilder.ts` (T002 will fill the gaps that this expansion exposes).
  - **Leverage**: existing entries (`specify`, `plan`, `tasks`, `implement`) for the array shape.

- [x] **T002** Add `analyze` / `clarify` to status + done-phrase tables and guard empty-substep rendering — `src/ai-providers/promptBuilder.ts` | R001, R002, R003, R005, R006
  - **Do**:
    1. Extend `COMPLETED_STATUS_BY_STEP` with `analyze: 'ready-to-implement'` and `clarify: 'specified'` — matching `deriveCompletedStatus` in `src/features/specs/stepLifecycle.ts`.
    2. Extend `DONE_PHRASE_BY_STEP` with `analyze: 'Done analyzing'` and `clarify: 'Done clarifying'`.
    3. In `renderPreamble`, when the substep array is empty, replace the `Canonical substeps for ${step}: ${substeps}.` line with `Canonical substeps for ${step}: none — single-pass step.` Otherwise keep the existing rendering byte-identical.
  - **Verify**: `npm run compile` clean; running `npm test -- promptBuilder` still passes all existing `specify` / `plan` / `tasks` / `implement` cases (no regression in the four supported steps).
  - **Leverage**: existing `COMPLETED_STATUS_BY_STEP` / `DONE_PHRASE_BY_STEP` declarations as the shape template.

- [x] **T003** [P] Extend `promptBuilder.test.ts` with `analyze` and `clarify` coverage — `src/ai-providers/__tests__/promptBuilder.test.ts` | R001, R002, R005, R006
  - **Do**:
    1. Extend the three for-loops that iterate `['specify', 'plan', 'tasks', 'implement'] as const` (preamble-wrap, char-budget, leave-currentStep) to also cover `'analyze'` and `'clarify'`.
    2. Add a focused case asserting `buildPrompt({ step: 'analyze', ... })` contains `Flip status to "ready-to-implement"` and `Done analyzing`, and that `buildPrompt({ step: 'clarify', ... })` contains `Flip status to "specified"` and `Done clarifying`.
    3. Add a case asserting the empty-substep rendering line: `Canonical substeps for analyze: none — single-pass step.`
  - **Verify**: `npm test -- promptBuilder` passes; the existing `'Canonical substeps for plan: research, design'` assertion still holds (plan still has substeps).
  - **Leverage**: the existing `'wraps command with preamble for each known step'` block as the loop pattern.

- [x] **T004** [P] Add CHANGELOG entry — `CHANGELOG.md` | R001, R007
  - **Do**: Under the next Unreleased / pending-version block, add one bullet: `Fixed: \`analyze\` and \`clarify\` no longer leave the spec viewer stuck on "needs regeneration" — \`buildPrompt\` now emits the context-update preamble for these steps (#194).`
  - **Verify**: Bullet renders correctly in the markdown preview; reads as one line; cross-references issue #194.
  - **Leverage**: prior CHANGELOG entries for tone and formatting.
