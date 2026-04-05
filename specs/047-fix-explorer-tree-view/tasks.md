# Tasks: Fix Explorer Tree View

**Plan**: [plan.md](./plan.md) | **Date**: 2026-04-05

---

## Phase 1: Core Implementation (Sequential)

- [x] **T001** Fix step status icon to prefer `step` over `currentStep` — `src/features/specs/specExplorerProvider.ts` | R001, R002
  - **Do**: In `SpecItem` constructor (~line 587), change `specContext.currentStep === documentType` to `(specContext.step ?? specContext.currentStep) === documentType` so the SDD-managed `step` field takes priority, falling back to `currentStep` when `step` is absent
  - **Verify**: Build passes; in explorer, a spec with `step: "implement"` and `currentStep: "plan"` shows blue dot on Implement, not Plan
  - **Leverage**: Existing `specContext.stepHistory` check pattern on line 585

- [x] **T002** Verify related docs render as children not siblings *(depends on T001)* — `src/features/specs/specExplorerProvider.ts` | R003
  - **Do**: Confirm `getChildren` (line 199) correctly returns related docs via `getRelatedDocItems` when parent has `contextValue` starting with `spec-document-` and `relatedDocs` is populated. If docs render as siblings, fix the `childDocs` assembly at line 494 or the `collapsible` state at line 495-497 to ensure parent step items get `Collapsed` state
  - **Verify**: In explorer, a step with subFiles shows a collapse toggle and related docs appear indented under the step

- [x] **T003** Verify unregistered markdown discovery and attachment *(depends on T002)* — `src/features/specs/specExplorerProvider.ts` | R004, R005
  - **Do**: Confirm `getRelatedDocs` (line 234) discovers `.md` files not in `mainDocs` and that the filtering at lines 444-491 correctly attaches them to the step with `includeRelatedDocs: true`. Ensure `spec.md`, `plan.md`, `tasks.md`, and hidden files are excluded. Fix any filtering gaps found
  - **Verify**: A markdown file placed in spec root (not spec.md/plan.md/tasks.md) appears as a child of the step with `includeRelatedDocs: true`

- [x] **T004** Add unit tests for step status icon logic *(depends on T001)* — `tests/` | R001, R002
  - **Do**: Add tests for `SpecItem` icon selection: (1) `step` present and differs from `currentStep` — icon uses `step`, (2) only `currentStep` present — icon uses `currentStep`, (3) step in `stepHistory` with `completedAt` — shows green pass icon regardless
  - **Verify**: `npm test` passes

---

## Progress

- Phase 1: T001–T004 [x]
