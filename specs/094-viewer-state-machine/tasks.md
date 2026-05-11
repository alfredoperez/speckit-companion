# Tasks: Viewer State Machine — Stepper, Header, Footer, Timeline

**Plan**: [plan.md](./plan.md)

> Format reference: `[P]` markers and parallel groups — see `skills/tasks/SKILL.md` § Phase rules.

## Phase 1: Footer Behavior

- [x] **T001** Add `isAwaitingApproval` predicate and tighten visibility rules — `src/features/spec-viewer/footerActions.ts` | R001, R002
  - **Do**: Add a private `isAwaitingApproval(ctx, step)` helper that returns true when `step.startedAt` is set, `completedAt` is null, and the step is not inferred-completed. Update `ARCHIVE.visibleWhen` and `COMPLETE.visibleWhen` to also require `!isAwaitingApproval(ctx, step)`. Tighten `SDD_AUTO.visibleWhen` from `status ∈ {draft, specifying}` to `status === 'draft'`.
  - **Verify**: `npm run compile` passes; existing footerActions tests still pass.
  - **Leverage**: `isStepCompleted` from `stateDerivation.ts`; the existing `FOOTER_ACTIONS` array.

- [x] **T002** [P] Add `getApproveLabel` helper and use it in `getFooterActions` — `src/features/spec-viewer/footerActions.ts` | R003, R004
  - **Do**: Export `getApproveLabel(currentStep, workflowSteps?)` that finds the step's index in `workflowSteps`, returns the next step's `label` (or capitalized `name`), `'Complete'` if final, `'Approve'` if missing/unknown. Extend `getFooterActions(ctx, step, workflowSteps?)` to map the visible Approve action to a fresh object with the dynamic `label`. Keep the action `id` `'approve'` so click handlers stay unchanged.
  - **Verify**: Compile passes; new label flows through serialization in `specViewerProvider.ts:306-311` (already uses `a.label`).
  - **Leverage**: `WorkflowStepConfig` from `src/features/workflows/types.ts`.

- [x] **T003** *(depends on T002)* Thread `workflowSteps` through derivation — `src/features/spec-viewer/stateDerivation.ts`, `src/features/spec-viewer/specViewerProvider.ts` | R003
  - **Do**: `deriveViewerState(ctx, activeStep?, workflowSteps?)` accepts an optional third parameter and forwards it to `getFooterActions`. Both call sites in `specViewerProvider.ts` (`refreshContextIfDisplaying` and the documentType-update handler) resolve `(getWorkflow(specCtx.workflow) || DEFAULT_WORKFLOW).steps` and pass it.
  - **Verify**: Compile passes; existing `stateDerivation.test.ts` mock keeps working.

## Phase 2: Tests

- [x] **T004** [P] Awaiting-approval suppression cases — `tests/unit/spec-viewer/footerActions.spec.ts` | R001, R002
  - **Do**: Add `describe('Awaiting-approval window')` with: (a) freshly generated specify (`status='specifying'`, `startedAt` set) hides Archive, Mark Completed, Auto; (b) Plan tab while planning hides Archive/Mark Completed; (c) post-completion (`status='specified'`, `completedAt` set) restores Archive/Mark Completed and hides Approve; (d) cold-start `draft` keeps Auto and Start visible.
  - **Verify**: `npm test -- --testPathPattern=footerActions` all green.

- [x] **T005** [P] Dynamic Approve label cases — `tests/unit/spec-viewer/footerActions.spec.ts` | R003, R004
  - **Do**: Add `describe('getApproveLabel')` covering next-step labels for each step in the SDD workflow, `'Complete'` on the final step, fallback `'Approve'` when steps array is undefined/empty/unmatched, and capitalized name when label is missing. Add a `describe('getFooterActions Approve label is dynamic')` asserting the visible Approve action's label is `'Plan'` on specify when steps are passed and `'Approve'` when omitted.
  - **Verify**: `npm test` all green (490+ tests).

## Phase 3: Documentation

- [x] **T006** Update viewer-states doc — `docs/viewer-states.md` | R001–R007
  - **Do**: In the "Footer scope tooltips" header block, add: (a) the awaiting-approval suppression rule, (b) the cold-start `draft`-only Auto rule, (c) the dynamic next-step Approve label, (d) a forward-looking overflow `⋯` menu note.
  - **Verify**: Doc renders cleanly; cross-references to `footerActions.ts` still valid.

- [x] **T007** [P] Update README — `README.md` | R001, R003
  - **Do**: In the "Reading Specs" section add a bullet describing the quiet awaiting-approval footer and dynamic next-step button. In the lifecycle-writes paragraph (~line 449), update "Approve / Regenerate buttons" wording to clarify the next-step button is dynamically labelled (`Plan`, `Tasks`, `Implement`, or `Complete`).
  - **Verify**: README references stay consistent with `docs/viewer-states.md`.

## Phase 4: Manual Verification

- [ ] **T008** *(depends on T001–T007)* Manual smoke in `ngx-dev-toolbar` — | R001–R004
  - **Do**: `/install-local` (already done — v0.15.1). In `ngx-dev-toolbar`, run `/sdd:specify some-feature`. Verify the viewer footer on the Specify tab shows only `Edit Source`, `Regenerate`, `Plan`. Click `Plan` and confirm the footer transitions correctly. Step through to Implement and confirm the button reads `Complete`. Manually patch a `.spec-context.json` to pure `draft` and confirm Auto reappears.
  - **Verify**: Screenshot the Specify-tab footer pre/post fix. Compare against `image-3-stateful-axolotl.png`.
