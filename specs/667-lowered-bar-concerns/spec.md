# Implement records the ways an agent lowered the bar

**Source**: #984

## User Scenarios & Testing

### User Story 1 - A skipped test shows up as a concern (Priority: P1)

An agent finishes implement with a test it quietly marked `.skip`. The checks still pass. When the run records its checks, the run also scans the lines the change added and records a concern that names the file and line, so the reviewer sees the skipped test on the Overview and in the pull request receipts without having to read the diff.

**Why this priority**: this is the whole point of the ticket: a corner cut that the green checks hide.

**Independent Test**: in a git project, add a test file with `it.skip(`, run the recorder that records implement's checks, and read the run record: one concern names that file and line.

**Acceptance Scenarios**:

1. **Given** the change adds a line with `it.skip(` at `app.test.ts` line 4, **When** implement records its checks, **Then** the run record holds a concern naming `app.test.ts:4` and what was found.
2. **Given** the same change, **When** implement closes, **Then** it closes as usual: the scan never fails or blocks the step.

### User Story 2 - A clean change records nothing (Priority: P1)

A change with no corner cuts adds no concern, so the Overview stays quiet for honest work.

**Why this priority**: a noisy scan teaches reviewers to ignore it.

**Independent Test**: record checks on a diff with only ordinary code; no new concern appears.

**Acceptance Scenarios**:

1. **Given** a change that adds only ordinary code and passing tests, **When** implement records its checks, **Then** no concern is added.

### User Story 3 - A cut with a reason is recorded as reasoned (Priority: P2)

Sometimes a suppression is right. When the line itself carries a reason, as in `eslint-disable-next-line no-console -- CLI output`, the concern says it was reasoned and quotes the reason, so the reviewer can tell a choice from a hidden cut.

**Why this priority**: it keeps honest suppressions from reading like hidden ones.

**Independent Test**: add a reasoned and an unreasoned suppression; the two concerns read differently.

**Acceptance Scenarios**:

1. **Given** an added line `// eslint-disable-next-line no-console -- CLI output`, **When** checks are recorded, **Then** the concern says it is reasoned and carries the reason.
2. **Given** an added `// @ts-ignore` with nothing after it, **When** checks are recorded, **Then** the concern says no reason was given.

### Edge Cases

- Not a git project, or git is missing: the scan records nothing and says nothing.
- A brand-new, untracked file: every line in it counts as added.
- Lines the change removed, and files under `specs/` and `.specify/`: never scanned.
- Checks recorded twice in one run: the concerns reflect the latest scan, not a doubled list; a cut the agent fixed in between disappears.
- A very large diff: the scan stays fast and caps how many hits it records, saying how many more it found.
- The word `skip` in ordinary code such as `skipWhitespace(`: not a hit.

## Requirements

### Functional Requirements

- **FR-001**: When implement records its checks, the run MUST scan the lines its change added (uncommitted edits and new files, outside `specs/` and `.specify/`).
- **FR-002**: The scan MUST find focused or skipped tests (`.skip(`, `.only(`, `xit(`, `xdescribe(`), type-check suppressions (`@ts-ignore`, `@ts-expect-error`, `@ts-nocheck`), lint suppressions (`eslint-disable`), empty function bodies, and coverage thresholds that went down.
- **FR-003**: Each hit MUST be recorded as a concern naming the file, the line and what was found.
- **FR-004**: A hit whose own line gives a reason (text after ` -- ` on that line) MUST be recorded as reasoned, with the reason; any other hit as unreasoned.
- **FR-005**: The scan MUST never block, fail or change the outcome of implement or of the recorded checks.
- **FR-006**: A clean change MUST add no concern.
- **FR-007**: A later scan in the same run MUST replace the earlier scan's concerns rather than add to them, and MUST leave every other concern untouched.
- **FR-008**: The hits MUST appear on the Overview with the other concerns and in the pull request receipts.

### Key Entities

- **Lowered-bar concern**: one hit. File, line, kind of cut, whether a reason was given and the reason. Stored with the run's other concerns, marked as coming from the scan so a later scan can replace it.

## Success Criteria

### Measurable Outcomes

- **SC-001**: An implement run that adds one `.skip` ends with exactly one concern naming its file and line.
- **SC-002**: A clean change ends with zero scan concerns.
- **SC-003**: Implement reaches `implemented` on a run with hits, every time.
- **SC-004**: The scan adds under one second on a diff of a few hundred lines.

## Assumptions

- The scan rides the existing check-recording call implement already makes (`--verify-run`), so it needs no new hook and shows up as run evidence. Implement commits its work only after that call, so "added lines" means the uncommitted diff plus new untracked files.
- "Empty function stub" means an added function whose body is empty on the same line (`{}`, `{ }`, or a Python `pass`-only body on the next line is out of scope).
- "Lowered coverage threshold" means an added line setting a coverage key (`branches`, `functions`, `lines`, `statements`, `threshold`, `fail_under`) whose removed counterpart in the same file held a higher number.
- The Overview already shows concerns, so the UI needs no change.

## Verbatim Constraints

- `--verify-run`
- `eslint-disable-next-line x -- reason`

## Approach

- New stdlib module `apps/speckit-extension/scripts/lowered_bar.py`: reads `git diff HEAD` plus untracked files, matches added lines, returns hits. Listed in `RUNTIME_SCRIPTS` and `.vscodeignore`.
- `capture.py` `append_verification_runs` calls it after the checks run and replaces the earlier scan's concerns (entries marked `"source": "scan"`) under the same lock; any error is swallowed.
- `receipts.py` adds one "Lowered the bar" line listing the scan's concerns, so the PR shows them too.
- No change to nodes or the viewer: implement already calls `--verify-run`, and the Overview already lists concerns.
- Tests in `apps/speckit-extension/tests/`, a changelog line.
