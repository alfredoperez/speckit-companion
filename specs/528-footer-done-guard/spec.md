# Feature Specification: Footer Done Guard

**Source**: [Issue #529](https://github.com/alfredoperez/speckit-companion/issues/529)

## User Scenarios & Testing

### User Story 1 - A finished spec offers only finish actions, never "advance" too (Priority: P1)

When a spec has finished building, the viewer footer should present only the actions that close it out — Mark Completed and Archive. A developer watching a fast-path spec complete should never see the forward "Implement" button lit at the same time as "Mark Completed". The lifecycle buttons are a state machine, and offering "advance to the next step" and "finish the run" side by side is contradictory and confusing.

**Why this priority**: This is the whole feature — one contradictory footer state that a real user hit and reported. Removing it delivers all the value.

**Independent Test**: Render the footer for a spec whose status says it is done building but whose recorded current step still lags behind, and confirm only the finish actions appear.

**Acceptance Scenarios**:

1. **Given** a spec that has finished building but whose recorded current step still trails behind the status (the transient fast-path skew), **When** the footer renders, **Then** the forward advance button is absent and only the finish actions (Mark Completed and Archive) are offered.
2. **Given** a spec that has been marked completed while its recorded current step still lags, **When** the footer renders, **Then** no forward advance button appears.
3. **Given** a spec still moving through the pipeline (not yet done building), **When** the footer renders, **Then** the forward advance button appears exactly as it does today — including the recovered-after-interruption case where the user rolled the status back to keep going.

### Edge Cases

- The status flips to "done building" before the pipeline records the final step's boundary — the exact window the report describes.
- A run that was interrupted and then rolled back so the developer can continue: the forward button must still appear (the finish guard must not swallow it).
- An already-archived spec: the forward button is already hidden; the guard must leave its finish actions untouched.

## Requirements

### Functional Requirements

- **FR-001**: The footer MUST NOT surface the forward advance action once the spec has reached a done-building state, regardless of whether the recorded current step has caught up.
- **FR-002**: While a spec is done, the footer MUST keep surfacing its finish actions (Mark Completed and/or Archive) exactly as it does today.
- **FR-003**: For a spec still moving through the pipeline (not yet done building), the forward advance action MUST remain visible exactly as before, including the recovered-after-interruption case.
- **FR-004**: The automated footer button matrix MUST include a case for the done-status / lagging-current-step skew, asserting the forward advance button is absent and only the finish actions render.
- **FR-005**: The documented footer button matrix MUST state that a done spec offers only its finish actions regardless of the recorded current step.

### Key Entities

- **Spec context** — the per-spec lifecycle record. Two attributes matter here: the lifecycle **status** (how far the spec has progressed) and the recorded **current step** (the step the pipeline last marked active). During a fast-path finish these two can transiently disagree, and that disagreement is the trigger for the bug.
- **Footer action** — a lifecycle button with a visibility rule. One action advances the pipeline forward; the finish actions (Mark Completed, Archive) close the spec out. They are meant to be mutually exclusive by state.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Across every done-building state, the forward advance button appears zero times; only finish actions render.
- **SC-002**: Across every not-yet-done stage that previously showed the forward advance button (including the recovered-after-interruption rows), it still appears — no forward-flow regression.
- **SC-003**: The footer matrix test suite passes with the new skew case included, and the full test run stays green.

## Assumptions

- "Done building" follows the existing lifecycle vocabulary — the `implemented` and `completed` stages the footer already treats as done. The `completed` and `archived` stages are already suppressed by the footer's existing terminal check, so the new guard's practical effect is closing the `implemented`-status skew window.
- The fix is a visibility guard in the shared footer rules, not a change to how status and current step get captured. Tightening the capture ordering so the two never skew is explicitly out of scope — the guard makes the footer correct regardless.

## Verbatim Constraints

- `shouldShowApprove` — the footer rule that gains the done-state guard, in `src/features/spec-viewer/footerActions.ts`.
- `isSpecDone` — the existing predicate that detects the done-building state (`implemented` / `completed`).
- `src/features/spec-viewer/__tests__/footerMatrix.test.ts` — the data-driven oracle that must exercise the skew case.
- `docs/viewer-states.md` — the footer button matrix reference to update.

## Approach

- Add an early `if (isSpecDone(ctx)) return false;` guard at the top of `shouldShowApprove` in `src/features/spec-viewer/footerActions.ts`, so a done spec never yields a forward advance action regardless of the current-step / history skew. (`completed` and `archived` are already suppressed by the existing `isTerminal` check on the `APPROVE` action; this closes the remaining `implemented`-status gap.)
- Add a fixture row to `src/features/spec-viewer/__tests__/footerMatrix.fixtures.ts` (consumed by the data-driven `footerMatrix.test.ts`): `status: implemented`, `currentStep: tasks`, expecting the right zone `['archive', 'complete']` and no `approve`.
- Update the footer button matrix in `docs/viewer-states.md` to note that a done spec offers only its finish actions regardless of the recorded current step.

Files to touch: `src/features/spec-viewer/footerActions.ts`, `src/features/spec-viewer/__tests__/footerMatrix.fixtures.ts`, `docs/viewer-states.md`.

## ADDED Requirements
<!-- capability: spec-viewer -->

### A done spec offers only its finish actions, never the forward advance

Once a spec has reached a done-building state, the footer MUST offer only its finish actions (Mark Completed / Archive) and MUST NOT surface the forward advance action, regardless of what the recorded current step says. A fast-path finish can flip the status to done before the pipeline records the final step's boundary, leaving the recorded current step transiently behind; the done status alone SHALL suppress the forward action so advance and finish are never offered together.

#### Scenario: the status is done but the recorded current step still trails
- **WHEN** a spec's status reports it is done building while its recorded current step lags at an earlier step
- **THEN** the footer offers only the finish actions
- **AND** the forward advance action is absent
