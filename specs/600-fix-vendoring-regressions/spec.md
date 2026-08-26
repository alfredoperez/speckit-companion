# Feature Specification: Fix 0.20.2 Vendoring Regressions

**Feature Branch**: `600-fix-vendoring-regressions`
**Created**: 2026-08-25
**Status**: Draft
**Input**: GitHub issue #588 — four regressions introduced while vendoring 0.20.2, where in each case a safety guard and the comment explaining it were deleted together.

## User Scenarios & Testing

### User Story 1 - Relocating capabilities never strands the project half-moved (Priority: P1)

A developer relocates several living-spec capabilities to a new location. Partway through, one move fails (a read-only target, a removed source, a cross-device rename). The moves already made are rolled back, so the project's files and its registry still agree and the developer can retry safely.

**Why this priority**: The current behavior silently leaves disk and registry disagreeing with no way back — data-integrity loss, the most serious of the four regressions.

**Independent Test**: Relocate three capabilities where the third move fails; verify the tree is exactly as it started.

**Acceptance Scenarios**:

1. **Given** three capabilities to relocate, **When** the third move raises an error, **Then** the first two moves are rolled back and the registry is unchanged.
2. **Given** a relocation where every move succeeds but the registry write fails, **When** the failure occurs, **Then** all moves are rolled back (existing behavior, preserved).
3. **Given** a relocation where every step succeeds, **When** it completes, **Then** files and registry both reflect the new locations (existing behavior, preserved).

### User Story 2 - Re-deriving a spec's state never duplicates its history (Priority: P2)

A developer re-runs the derivation that reconstructs a spec's lifecycle record from its files while the spec sits at the same step. The record gains no duplicate entries — the step's start appears exactly once, matching how every other writer of the record behaves.

**Why this priority**: Duplicate history corrupts the durable record the viewer and timing displays are built on, but only occurs on re-runs.

**Independent Test**: Derive twice at one step; the record carries one start entry for that step.

**Acceptance Scenarios**:

1. **Given** a spec already derived at a step, **When** derivation runs again at the same step, **Then** the history carries exactly one start entry for that step.
2. **Given** a spec that advances to a later step, **When** derivation runs at the new step, **Then** a start entry for the new step is appended as before.

### User Story 3 - A crash mid-write never truncates the capability registry (Priority: P2)

A developer registers a capability and the process dies mid-write (power loss, kill signal). The registry on disk is either its previous state or the new state — never a half-written or empty file.

**Why this priority**: A truncated registry silently disables the living-specs feature for the whole project; the sibling writer already guarantees atomicity, so the two are inconsistent today.

**Independent Test**: Verify the registry write goes through a temporary file renamed into place, matching the relocation tool's writer.

**Acceptance Scenarios**:

1. **Given** an existing registry, **When** a registration write is interrupted before completing, **Then** the on-disk registry is the previous state or the new state, never partial.
2. **Given** a registration that succeeds, **When** it completes, **Then** the registry content is identical to what the previous (non-atomic) writer produced.

### User Story 4 - The implement command's steps read in order (Priority: P3)

A developer (or an AI agent) reads the assembled implement command. Its numbered steps run consecutively — the final step is numbered 7, not a second 5 — so the instructions cannot be misread as out-of-order or duplicated.

**Why this priority**: Cosmetic, but the command body is the contract an AI executes; a repeated number invites misexecution.

**Independent Test**: The assembled implement command's top-level steps read 1 through 7 with no repeats.

**Acceptance Scenarios**:

1. **Given** the assembled implement command, **When** its top-level numbered steps are listed, **Then** they read 1, 2, 3, 4, 5, 6, 7.
2. **Given** the fix is made in the source node, **When** the bodies are re-assembled and the frozen baseline re-blessed, **Then** the assembly parity gates pass.

### Edge Cases

- What happens when the very first move of a relocation fails? Nothing was done, so rollback restores nothing and the error still surfaces.
- What happens when rollback itself fails partway? The original error still surfaces; rollback is best-effort restoration (existing behavior, unchanged).
- What happens when derivation runs at a step whose start was recorded by a different writer? The guard deduplicates on the step identity, so no second entry is appended.
- What happens when the registry's parent directory does not exist at write time? It is created before the write, as today.

## Requirements

### Functional Requirements

- **FR-001**: A relocation that fails partway through its file moves MUST roll back every move already made, leaving files and registry as they were before the run.
- **FR-002**: The rollback accounting MUST be owned by the caller and each entry recorded **before** its move is attempted, so the set to roll back covers the move that was in flight — whose destination directories the move had already created — and not only the moves that fully landed.
- **FR-003**: The restored rollback rationale MUST be recorded in the mover's docstring, including the explanation that a return value would never arrive on a partial failure.
- **FR-004**: Re-running state derivation at a step that already has a start entry MUST NOT append a second start entry, matching the sibling writer's guard.
- **FR-005**: The capability registration's registry write MUST be atomic — written to a temporary file and renamed into place — matching the relocation tool's registry writer exactly.
- **FR-006**: The assembled implement command's top-level steps MUST be numbered consecutively, with the final step numbered 7; the fix MUST be made in the source node, with the bodies re-assembled and the frozen baseline re-blessed as its own visible change.
- **FR-007**: Each of the three behavioral fixes MUST be pinned by a regression test: a 3-move relocation whose third move raises leaves the tree as it started; deriving twice at one step produces one history entry; the registry write goes through a temporary file.
- **FR-008**: The spec-kit extension changelog MUST gain an Unreleased entry describing the fixes in user-facing release-note voice, with no version bump.

## Success Criteria

### Measurable Outcomes

- **SC-001**: A 3-move relocation whose third move fails ends with 100% of the tree restored to its pre-run state.
- **SC-002**: Deriving twice at one step yields exactly 1 start entry for that step in the durable record.
- **SC-003**: An interrupted registry write leaves a readable registry (old or new state) 100% of the time.
- **SC-004**: The assembled implement command's step numbers form the sequence 1–7 with zero repeats.
- **SC-005**: The full Python and TypeScript test suites, and every assembly/manifest/quality gate, pass.

## Assumptions

- The fixes restore the 0.20.1 behavior exactly as the issue documents; no new behavior is introduced.
- The restored comments/docstring lines are the ones the issue quotes — they explain non-obvious rationale and are the guard against a future refactor re-deleting the code.
- The step-numbering fix lives in whichever node under the implement command's source carries the final mark-complete step.

## ADDED Requirements
<!-- capability: capture-runtime -->

### A capability relocation is transactional — a partial failure rolls back every applied move

Relocating capabilities moves files and then rewrites the registry. When any move or the registry write fails partway, every move already applied MUST be rolled back so files and registry never disagree. The rollback accounting is owned by the caller and each entry is recorded **before** its move is attempted, so the set to undo exists even when a move raises before the batch finishes — and covers the move that was in flight, whose destination directories were already created.

#### Scenario: a later move in the batch fails
- **WHEN** the third of three moves raises an error
- **THEN** the first two moves are undone and the tree and registry are as they were before the run

#### Scenario: the registry write fails after the moves
- **WHEN** every move succeeds but the config write raises
- **THEN** all moves are rolled back and the original registry content is restored

## Verbatim Constraints

- The restored docstring line in the mover: `Callers pass their own list so a move that raises part-way through still leaves them the set to roll back — a return value would never arrive.`
- The restored derivation guard: `if not wc._has_step_start(log, step, None):`
- The final assembled implement step number: `7.`
