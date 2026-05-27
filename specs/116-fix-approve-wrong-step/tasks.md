# Tasks: Fix Approve Wrong Step

**Plan**: [plan.md](./plan.md)

## Phase 1: Core Implementation

- [x] **T001 [P]** Bundle staged CLAUDE.md doc rules into this PR's commit — `CLAUDE.md` | (docs)
  - **Do**: No new edits. The working tree already has the storybook stories sibling-update rule, the "no hard-wrapped paragraphs" markdown rule, the Code Comments section, and the new Feature→README row for stories. Verify the diff before `/sdd:implement` runs `git add` so these land in the same commit as the fix.
  - **Verify**: `git diff CLAUDE.md` shows the three new rule sections + the new Feature→README row, no stray reverts.
  - **Leverage**: already-staged working-tree changes from the user.

- [x] **T002** Route Approve dispatch off `ctx.currentStep` — `src/features/spec-viewer/messageHandlers.ts` | R001, R002, R003
  - **Do**: In `handleApprove` (around line 373–388), read `ctx` earlier (or reuse the existing read at line 394) and compute `currentIndex = navSteps.findIndex((s) => s.name === ctx.currentStep)` first. Only run the `docType`-based related-doc / `parentStep` fallback when this primary lookup returns `-1` (covers the `actionOnly` implement step case). Leave the label path in `stateDerivation.ts` untouched.
  - **Verify**: `npm run compile` passes; manual repro — spec at `currentStep=tasks`, click Specification tab, click Implement → output channel logs `Executing step "Implement": /speckit.implement …`.
  - **Leverage**: existing completion-target read at line 394 already reads `ctx.currentStep` — same source-of-truth pattern.

- [x] **T003** Regression test for past-tab dispatch — `tests/unit/spec-viewer/messageHandlers.spec.ts` | R004
  - **Do**: Extend the existing `messageHandlers.spec.ts` with a `describe("handleApprove dispatch routing")` block. Construct `ctx` with `currentStep = "tasks"`, build an instance whose `currentDocument = "specify"`, mock `resolveWorkflowSteps` to return canonical navSteps + actionOnly implement, invoke `handleApprove`, and assert the step passed to `executeStepInTerminal` is the implement step (its name = `"implement"`, dispatched command = `/speckit.implement`). Add a same-step control case (`currentStep = "tasks"`, `currentDocument = "tasks"`) that asserts the same outcome — no regression.
  - **Verify**: `npm test` — new tests pass alongside existing message-handlers tests.
  - **Leverage**: existing scaffolding in `tests/unit/spec-viewer/messageHandlers.spec.ts` and the VS Code mock at `tests/__mocks__/vscode.ts`.
