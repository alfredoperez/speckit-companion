# Plan: Viewer State Machine — Stepper, Header, Footer, Timeline

**Spec**: [spec.md](./spec.md)

## Approach

Two kinds of work, separated cleanly:

1. **Footer behavior changes** (R001–R004) — code-level changes in
   `src/features/spec-viewer/footerActions.ts` to introduce the
   `isAwaitingApproval` predicate, restrict `Auto` to pure draft,
   and rewrite the `Approve` action's `label` based on the active
   workflow's next step. Plumbed via an optional `workflowSteps`
   parameter through `deriveViewerState` → `getFooterActions`.
2. **Documentation** (R005–R007) — capture the existing stepper,
   header, and timeline state derivation rules in
   `docs/viewer-states.md` so future contributors can read one
   document for the full state machine.

R008 (testability) is satisfied by the existing pure-function
architecture (`stateDerivation.ts`, `footerActions.ts`); no
refactor needed.

## Files

### Modify

- `src/features/spec-viewer/footerActions.ts`
  - Add `isAwaitingApproval(ctx, step)` predicate.
  - Tighten `ARCHIVE` and `COMPLETE` `visibleWhen` to also exclude
    awaiting-approval.
  - Tighten `SDD_AUTO` `visibleWhen` to require
    `status === 'draft'` only.
  - Add `getApproveLabel(currentStep, workflowSteps)` helper that
    looks up the next step's label.
  - Extend `getFooterActions(ctx, step, workflowSteps?)` to rewrite
    the Approve action's `label` after filtering.
- `src/features/spec-viewer/stateDerivation.ts`
  - `deriveViewerState` accepts an optional `workflowSteps:
    WorkflowStepConfig[]` and forwards it to `getFooterActions`.
- `src/features/spec-viewer/specViewerProvider.ts`
  - Both `deriveViewerState` call sites resolve workflow steps via
    `(getWorkflow(specCtx.workflow) || DEFAULT_WORKFLOW).steps` and
    pass them in.
- `tests/unit/spec-viewer/footerActions.spec.ts`
  - Add cases for awaiting-approval suppression on specify and on
    plan, restoration after completion, cold-start draft, dynamic
    next-step label per step, and fallback when no workflow is
    provided.
- `docs/viewer-states.md`
  - Document the awaiting-approval suppression block, the dynamic
    Approve label rule, the cold-start `draft` exception for Auto,
    and a forward-looking overflow-menu note.
- `README.md`
  - Reading Specs: brief mention of the quiet awaiting-approval
    footer.
  - Lifecycle-writes paragraph: clarify that the next-step button
    is dynamically labelled (`Plan`, `Tasks`, `Implement`,
    `Complete`).

### Create

- `specs/094-viewer-state-machine/{spec.md, plan.md, tasks.md,
  .spec-context.json}` (this folder).

## Testing Strategy

- **Unit**: extend `tests/unit/spec-viewer/footerActions.spec.ts`
  with cases enumerated above. All must run via existing
  `ts-jest` config without VS Code stubs (footerActions stays free
  of `vscode` imports — workflow lookup happens at the provider
  edge).
- **Manual**: `/install-local`, then in `ngx-dev-toolbar`:
  1. Run `/sdd:specify`. Viewer footer = `Edit Source`,
     `Regenerate`, `Plan`. ✅
  2. Click `Plan` → footer becomes `Edit Source`, `Regenerate`,
     `Tasks`. ✅
  3. On the final implement step, button reads `Complete`. ✅
  4. Manually edit `.spec-context.json` to `status: "draft"` with
     empty `stepHistory` — Auto should be visible. ✅
- **Regression**: full `npm test` (490+ tests).

## Out of Scope

- Refactoring the webview's footer renderer
  (`webview/src/spec-viewer/components/FooterActions.tsx`). It
  already consumes `viewerState.footer[]` and was not touched —
  the dynamic label flows through transparently.
- Stepper / header / timeline behavior changes — those are
  documented as-is. No code edits to those subsystems in this
  branch.
