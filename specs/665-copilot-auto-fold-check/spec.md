# Release QA trusts a real fold on the Copilot app

**Source**: #978

## User Scenarios & Testing

### User Story 1 - A folded Auto run passes the check (Priority: P1)

The person running release QA runs the headless canvas checks. Auto on a one-file change folds plan and tasks, and along the way the model opens the tasks command's file to read it. The check reports PASS, because reading a file is not running the command.

**Why this priority**: today this run fails, so release QA files a bug against a product that works.

**Independent Test**: feed the check the 2026-11-08 run's shape and see PASS.

**Acceptance Scenarios**:

1. **Given** a run sized `simple` whose record holds plan and tasks starts and completes written by the extension within one second, and whose only mention of the tasks command is a file view, **When** the check judges it, **Then** the result is PASS.
2. **Given** the same run, **When** the check reports, **Then** the evidence says no plan or tasks command ran.

### User Story 2 - A real plan run still fails (Priority: P1)

When the model really runs the plan or tasks command on a simple change, the check still fails and names the call in full.

**Why this priority**: the check must keep catching the bug it exists for.

**Independent Test**: feed the check a run where plan was invoked and its boundaries span minutes; see FAIL with the whole call in the evidence.

**Acceptance Scenarios**:

1. **Given** a simple run where the plan command was invoked and plan's start and complete are minutes apart, **When** the check judges it, **Then** the result is FAIL.
2. **Given** that FAIL, **When** the evidence is read, **Then** it shows the offending call in full, not cut short.

### Edge Cases

- The record holds plan and tasks completes but not written together: not a fold, FAIL.
- A fold boundary written by `ai` instead of the extension: not the fold signature, FAIL.
- A search or listing that names the command (a glob, a grep) counts as a read, not a run.
- No `tasks.md` written: FAIL, as before.

## Requirements

### Functional Requirements

- **FR-001**: The check MUST count only real invocations of the plan or tasks command, never views, globs or searches of their files.
- **FR-002**: The check MUST judge the fold from the record: plan and tasks starts and completes all written by the extension within one second of each other.
- **FR-003**: The check MUST show each offending call in full in its evidence.
- **FR-004**: The 2026-11-08 run shape MUST pass, and a run where plan really ran MUST fail, both proven by an automated test.

## Success Criteria

### Measurable Outcomes

- **SC-001**: The 2026-11-08 run shape judges PASS.
- **SC-002**: A run with a real plan invocation judges FAIL.
- **SC-003**: The new test runs in the repo's existing test command.

## Assumptions

- A real invocation is any tool call naming the command that is not a file read; a mention inside a path to a `.md` file is a read.
- The live harness is not re-run here; the test stands in for it.
- #817's leftover F3 item (a wandered session reads `SKILL.md`) is out of scope.

## Approach

- Move the judgement into a pure `judgeAutoFold` in a new `.claude/skills/release-qa/canvas-harness/auto-folds.mjs`, taking the run's tool calls, replies, record and whether `tasks.md` exists.
- `checks.mjs` `autoFolds` keeps the session work and calls `judgeAutoFold`.
- New `auto-folds.test.mjs` beside it (node:test), added to the `test:canvas` script glob in `package.json`.
