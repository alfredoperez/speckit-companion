# Feature Specification: Command-family-aware capture preamble

**Feature**: 352-family-aware-preamble
**Issue**: #352

## User Scenarios & Testing

### User Story 1 - Companion command dispatch gets a slim preamble (Priority: P1)

When the extension dispatches a Companion command (`/speckit.companion.specify`, `.plan`, `.tasks`, `.implement`), the command body already carries the full capture-and-timing protocol. The preamble the extension prepends should NOT repeat that protocol — it should carry only the *dynamic dispatch context* the static body cannot self-source: the real dispatch timestamp, the feature directory, and the guard against writing the next step's start. This trims wasted tokens and removes the chance the model double-logs from two copies of the same rules.

**Why this priority**: This is the core of the ticket — the duplication is the defect. Without it, every companion dispatch ships two copies of the protocol prose.

**Independent Test**: Render the preamble for a companion command (e.g. `/speckit.companion.plan`) and confirm it contains the dispatch timestamp, the feature dir, and the next-step guard, but NOT the shared protocol prose (schema rules, per-task finish boilerplate, status lifecycle table).

**Acceptance Scenarios**:
1. **Given** a `/speckit.companion.plan` dispatch, **When** the preamble is rendered, **Then** it includes the real dispatch timestamp and the feature dir and the "don't write the next step's start" guard.
2. **Given** the same dispatch, **When** the preamble is rendered, **Then** it does NOT include the full shared protocol prose that the companion command body already states.

### User Story 2 - Stock command dispatch keeps the full preamble and uses `--advance` (Priority: P1)

When the extension dispatches a stock command (`/speckit.specify`, `.plan`, …), the preamble is the ONLY capture source — the stock body says nothing about capture. So the preamble stays full. Its status-flip instruction should use the modern `write-context.py --step <step> --advance --by ai` verb (one call that finishes the step and flips status forward-only) instead of the old `--finish` + separate `--status` dance.

**Why this priority**: A stock dispatch with a slimmed preamble would lose all capture. The `--advance` modernization removes the awkward two-step status flip the AI had to improvise.

**Independent Test**: Render the preamble for a stock command (e.g. `/speckit.plan`) and confirm it carries the full protocol AND references the `--advance` verb for the canonical advancing steps.

**Acceptance Scenarios**:
1. **Given** a `/speckit.plan` dispatch, **When** the preamble is rendered, **Then** it carries the full capture protocol (schema, status lifecycle, shared rules).
2. **Given** the same dispatch, **When** the closing instruction is rendered for an advancing step (specify/plan/tasks), **Then** it references `write-context.py --step <step> --advance --by ai`.
3. **Given** a finish-only step (clarify/analyze), **When** the closing instruction is rendered, **Then** it records a finish without advancing status.

### User Story 3 - Create-spec flow gets the same slim/full split (Priority: P2)

The create-spec flow has no command verb yet, so it keys its companion-vs-stock decision off install state. That signal stays, but the same slim/full split applies: a companion create dispatch gets the slim body, a stock create dispatch gets the full one.

**Why this priority**: Consistency — the create flow is the one path without a command verb, and leaving it full-only would re-introduce the duplication on that path.

**Independent Test**: Render the create-spec preamble with `companionInstalled = true` vs `false` and confirm the slim/full split mirrors the command-dispatch split.

**Acceptance Scenarios**:
1. **Given** a companion create dispatch, **When** the preamble is rendered, **Then** the lifecycle body is slim (no duplicated protocol prose).
2. **Given** a stock create dispatch, **When** the preamble is rendered, **Then** the lifecycle body is full.

## Edge Cases

- Finish-only steps (`clarify`, `analyze`) must not be told to `--advance` (they have no canonical advanced status) — they finish only.
- The slim companion preamble must still keep the next-step-start guard; dropping it would let the model write a phantom "Generating <next>…".
- When `aiContextInstructions` is off, no preamble is built at all (unchanged).
- Implement step never self-advances on either path (its watcher/hook closes it); the slim/full split must not change that.

## Requirements

### Functional Requirements

- **FR-001**: The system MUST emit a slim preamble for a companion command dispatch, containing the dispatch timestamp, feature dir, and next-step-start guard, but omitting the shared protocol prose the companion command body already carries.
- **FR-002**: The system MUST emit a full preamble for a stock command dispatch, retaining the schema, status lifecycle, and shared rules.
- **FR-003**: The stock-path closing instruction MUST use `write-context.py --step <step> --advance --by ai` for the steps that advance status (specify, plan, tasks), and a finish-only call for steps that don't (clarify, analyze).
- **FR-004**: The slim/full decision for a command dispatch MUST be conditioned on command family via the existing `companionRecordsSteps(command)` signal, not on install state.
- **FR-005**: The create-spec flow MUST apply the same slim/full split, keyed off its install-state signal (it has no command verb).
- **FR-006**: The implement step MUST continue to defer its close to the watcher/hook on both paths.

## Success Criteria

### Measurable Outcomes

- **SC-001**: A companion command preamble is measurably shorter than the equivalent stock command preamble (fewer characters / no duplicated protocol prose).
- **SC-002**: The stock command preamble references the `--advance` verb for advancing steps.
- **SC-003**: A per-family rendering test passes, asserting the slim companion preamble and the full stock preamble.
- **SC-004**: `npm run compile && npm test` is green.

## Assumptions

- The `--advance` verb is already shipped on `main` (#351/#354) with the canonical map specify→specified, plan→planned, tasks→ready-to-implement, implement→implemented; clarify/analyze finish-only.
- "Dynamic dispatch context" = the dispatch timestamp, the feature dir, and the next-step-start guard. These are load-bearing for honest timing and are kept on the slim path.

## Verbatim Constraints

- `write-context.py --step <step> --advance --by ai` — the modern status-flip verb the stock path must reference.
- `companionRecordsSteps(command)` — the existing command-family signal to condition on.
