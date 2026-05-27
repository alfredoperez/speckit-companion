# Plan: Fix Approve Wrong Step

**Spec**: [spec.md](./spec.md)

## Approach

Inside `handleApprove`, compute `currentIndex` from `ctx.currentStep` first; only fall back to the `docType`-based related-doc / parent-step resolution when `ctx.currentStep` isn't in `navSteps` (e.g., the `actionOnly` `implement` step). The completion-target write already reads `ctx.currentStep` — the dispatch routing just needs the same source of truth. The `docType` fallback stays so the function remains defensive against the actionOnly edge case.

Also bundled in this PR: documentation rules already staged in the working tree on `CLAUDE.md` — a stories-sibling-update rule, a no-hard-wrapped-paragraphs markdown rule, and a code-comments hygiene section. They ride the same commit at the user's request so the guidance lands together.

## Files to Change

### Modify

- `src/features/spec-viewer/messageHandlers.ts` — in `handleApprove` (~line 373–388), change the `currentIndex = navSteps.findIndex((s) => s.name === docType)` line to search by `ctx.currentStep` first, then keep the `docType` related-doc fallback when the primary lookup misses.
- `CLAUDE.md` — already staged: stories sibling-update rule, markdown no-hard-wrap rule, code-comments section, new Feature→README row for stories. Commit as-is — no further edits.

### Create

- `tests/unit/spec-viewer/handleApprove-dispatch.spec.ts` (or extend `messageHandlers.spec.ts` if the existing scaffolding covers `handleApprove`) — one regression case: `ctx.currentStep = "tasks"`, `docType = "specify"`, assert dispatched command is `/speckit.implement`. One same-step sanity case as a control.

## Testing Strategy

- **Unit**: Jest test that mocks `resolveWorkflowSteps`, `getInstance`, `executeStepInTerminal` (via `deps`), and `readSpecContextSync` to return `currentStep: "tasks"`. Assert the step passed into `executeStepInTerminal` is the implement step (not plan or tasks).
- **Manual**: Walk a spec to `currentStep=tasks` (use `specs/_02_demo-tasked`), click the **Specification** stepper tab, click footer **Implement** → output channel logs `/speckit.implement`. Repeat for `specify→plan` and `plan→tasks` transitions with the stepper pointed at earlier tabs.

## Risks

- **Test scaffolding for `handleApprove` may not exist yet.** `messageHandlers.spec.ts` is small; mocking `getInstance`, `resolveWorkflowSteps`, `executeStepInTerminal`, and `readSpecContextSync` may be heavier than the production change. If so, keep the test minimal — assert only the dispatched step name.
- **`relatedDoc.parentStep` fallback path** demotes from primary to secondary. The third spec scenario (viewing a related doc while `ctx.currentStep` is a lifecycle step) must still pass — exercise it manually after the change.
