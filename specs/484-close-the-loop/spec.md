# Completing the pipeline closes the loop

## User Scenarios & Testing

### User Story 1 - The panel unlocks the moment tasks finishes (Priority: P1)

A developer runs a feature through specify, plan, and tasks. When the tasks step finishes, the spec viewer should settle and offer the next action ("advance to implement"). Today the panel keeps showing "Step running — actions unlock when it settles" and locks the buttons, because the run's history says tasks completed but the top-level `status` field still holds the in-progress value (`tasking`), and the panel trusts `status`.

**Why this priority**: This is a hard stop. The developer cannot advance the pipeline from the UI at all — the only workaround is hand-editing the run state, which no user should ever have to do. It blocks the core promise that finishing a step moves you forward.

**Independent Test**: Take a recorded run where the tasks step's completion is in `history[]` but the top-level `status` still reads `tasking`, and confirm the derived viewer state treats the step as settled and surfaces the forward action.

**Acceptance Scenarios**:

1. **Given** a spec whose `history[]` records the tasks step completed but whose top-level `status` still reads `tasking`, **When** the viewer derives its state, **Then** the tasks step reads as settled and the footer offers the forward action.
2. **Given** the same lagging-status spec, **When** the extension reconciles the recorded context, **Then** the top-level `status` is moved forward to `ready-to-implement` so the on-disk record matches the history.
3. **Given** a spec whose tasks step is genuinely still running (its last tasks entry is a start, not a completion), **When** the viewer derives its state, **Then** the step still reads as running and no forward action is offered.
4. **Given** the specify and plan steps that settle correctly today, **When** they finish, **Then** their settle behavior is unchanged (no regression).

### User Story 2 - Completing a feature records its changes back into the living spec (Priority: P1)

A developer runs a feature that loads capability living specs and changes their behavior, then marks it complete. The fold-back step should record the feature's changes into that capability's living spec, or clearly say why it did not. Today fold-back is a silent no-op for any feature built through the standard pipeline, and the message it prints lists four possible reasons as one line, so nobody can tell which one applied.

**Why this priority**: The whole point of living specs is that finishing a feature improves the durable record for the next one. If completion writes nothing back, the record never learns from the work — living specs stay read-only forever.

**Independent Test**: Complete a feature whose spec carries a real capability delta block and confirm the change lands in the capability spec; complete a feature that loaded capabilities but wrote no delta block and confirm it produces a clear, actionable message naming that exact reason rather than a silent success.

**Acceptance Scenarios**:

1. **Given** a completed feature whose spec carries an `## ADDED / MODIFIED / REMOVED / RENAMED Requirements` delta block for a resolved capability, **When** fold-back runs, **Then** the change is written into that capability's living spec and the synced name is recorded.
2. **Given** a completed feature that loaded one or more capabilities but wrote no delta block, **When** fold-back runs, **Then** it emits a single message naming that exact reason and pointing at the way to sync — not a four-way list of possibilities, and not a silent success.
3. **Given** a completed feature that genuinely changes no capability requirements and loaded no capabilities, **When** fold-back runs, **Then** it folds nothing and says so plainly.
4. **Given** any of the fold outcomes above, **When** fold-back reports, **Then** the reason it prints is the one that actually fired (disabled, no capability resolved, no delta block, or already up to date) rather than an OR-string of all of them.

### Edge Cases

- A step completion recorded under the legacy `from`-based schema (no explicit `kind`) must still be read as settled.
- A spec at `implementing` whose tasks are all done must not be dragged to `completed` by the settle path — reaching the closed state stays the user's mark-complete action.
- A feature spec that carries a delta block whose heading matches nothing in the capability spec must report the skipped change, not claim success.
- Fold-back must remain a clean, quiet outcome only when the feature genuinely changed nothing.

## Requirements

### Functional Requirements

- **FR-001**: The derivation that decides whether a step is in flight MUST treat a step whose completion is recorded in `history[]` as settled, even when the top-level `status` still names that step as running.
- **FR-002**: The viewer footer MUST offer the forward action for a step whose completion is recorded in history, regardless of a lagging top-level `status`.
- **FR-003**: A step that is genuinely still running (its latest history entry for that step is a start, not a completion) MUST continue to read as in flight.
- **FR-004**: The extension's context reconciler MUST move a lagging in-progress `status` forward to the step's settled status when history records that step's completion, so the on-disk record matches the run.
- **FR-005**: The reconciler settle MUST be forward-only — it MUST never move `status` backward and MUST never write the terminal closed status on its own.
- **FR-006**: The settle behavior for the specify and plan steps MUST be unchanged.
- **FR-007**: Fold-back at completion MUST, when the feature spec carries a requirement delta block for a resolved capability, apply that delta to the capability's living spec and record the synced capability names.
- **FR-008**: When fold-back does nothing, it MUST report the single reason that actually applied — living specs off, no capability resolved, no delta block, or already up to date — never a list of all possible reasons.
- **FR-009**: When fold-back finds no delta block but the feature loaded one or more capabilities, it MUST emit an actionable message that names the loaded capabilities and points at how to sync, rather than reporting a silent success.
- **FR-010**: Fold-back MUST remain opt-in (only acts when living specs are enabled), best-effort (never fails the host command), and idempotent (re-running folds nothing new).
- **FR-011**: Reading of living specs at specify time MUST be unchanged — features keep loading the right capabilities before work starts, recorded on `livingSpecs.loaded`.

## Success Criteria

### Measurable Outcomes

- **SC-001**: For a run whose tasks completion is in history but whose `status` still reads `tasking`, the viewer offers the forward action in 100% of cases, with zero hand-edits of run state required.
- **SC-002**: A finished step is never shown as still running once its completion is in history.
- **SC-003**: Completing a feature with a real capability delta block updates the capability living spec in 100% of cases.
- **SC-004**: Every fold-back no-op prints exactly one reason, and that reason matches the condition that fired.
- **SC-005**: No regression to specify/plan settling or to specify-time living-spec loading.

## Assumptions

- The observed lock is a status/history desync, not a missing history completion — history already records the tasks completion.
- The primary, most robust fix is to make the derived viewer state resilient to a lagging status; the reconciler settle is a defensive second layer that also heals the on-disk `status` field.
- The standard specify → plan → tasks pipeline does not itself produce delta blocks, so fold-back for a normally-built feature is expected to hit the no-delta path; the fix makes that outcome observable and actionable rather than adding automatic delta synthesis.

## ADDED Requirements

<!-- capability: viewer-ui -->

### A recorded step completion settles the step even when status lags

A step whose completion is recorded in the run's history is read as settled, and its forward action reappears, even when the top-level status still names that step as running. A lagging status can never keep a finished step spinning or hold the panel locked.

#### Scenario: history records the current step complete but status still names it running

- **WHEN** the current step's completion is present in history but the top-level status still names that step as in progress
- **THEN** the step reads as settled and no spinner runs
- **AND** the forward-motion action reappears

#### Scenario: the step is genuinely still running

- **WHEN** the current step's latest history entry is a start with no matching completion
- **THEN** the step reads as running and the forward action stays withheld

> The companion requirement for #492 — fold-back naming its exact outcome and surfacing loaded-but-unfolded capabilities — is recorded in the `capture-runtime` living spec's own change record and the spec-kit extension CHANGELOG, not folded here: the fold grammar applies one delta set to its target, so routing this feature's cross-cutting change through a single `viewer-ui` block keeps each capability spec honest.
