# Tasks: Immediate Status Update

**Plan**: [plan.md](./plan.md) | **Date**: 2026-04-22

---

## Phase 1: Core Implementation (Sequential)

- [x] **T001** Repaint viewer after approve — `src/features/spec-viewer/messageHandlers.ts` | R001, R004
  - **Do**: In `handleApprove`, after the `completeStep`/`startStep` writes finish (both the "next nav step" branch around line 273 and the "actionOnly implement" branch around line 281) and before `executeStepInTerminal`, add `await deps.updateContent(specDirectory, instance.state.currentDocument)`.
  - **Verify**: Open a spec, view `plan.md`, click Approve — the status badge flips to `CREATING TASKS...` immediately (before the terminal prints anything). Same check for tasks → implement.
  - **Leverage**: `handleLifecycleAction` at line 312 — same `deps.updateContent` pattern already used there.

- [x] **T002** Repaint viewer after regenerate — `src/features/spec-viewer/messageHandlers.ts` | R002, R004
  - **Do**: In `handleRegenerate`, after the `startStep` call and before `executeStepInTerminal`, add `await deps.updateContent(specDirectory, instance.state.currentDocument)`.
  - **Verify**: Click Regenerate on a step — badge updates to the in-progress form immediately.

- [x] **T003** Force step-completion in the prompt preamble — `src/ai-providers/promptBuilder.ts` | R003
  - **Do**: In `renderPreamble` (the single-step preamble used by `buildPrompt`), replace the soft "Post-step: set stepHistory.{step}.completedAt …" line with a prescriptive **MUST DO BEFORE ENDING** block that lists three required actions, in order:
    1. Set `stepHistory.{step}.completedAt = now`.
    2. Flip `status` from its in-progress form to the matching completed form (e.g., `planning` → `planned`, `tasking` → `ready-to-implement`, `implementing` → `completed`).
    3. Print a single visible line `Done {step}` (use human phrasing: `Done planning`, `Done creating tasks`, `Done implementing`).
    Keep `STATUS_LIFECYCLE` as the reference table for the status mapping; the new block should reference it rather than duplicating. Do NOT weaken the existing "transitions is append-only" invariant.
  - **Verify**: Click Approve on a spec viewing `plan.md` → terminal runs `/sdd:tasks` → when the AI finishes, `.spec-context.json` shows `status: "ready-to-implement"` and `stepHistory.tasks.completedAt` is set, and the terminal shows a `Done creating tasks` line. Re-run for `plan` (should land on `planned`) and `implement` (should land on `completed`). Unit tests in `src/ai-providers/__tests__/promptBuilder.test.ts` still pass (adjust string assertions that hit the preamble wording).
  - **Leverage**: Existing `STATUS_LIFECYCLE` array and `renderPreamble` in `promptBuilder.ts:29`.

---

## Progress

- Phase 1: T001–T003 [x]
