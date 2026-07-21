# Feature Specification: Command-Quality Eval

**Feature Branch**: `511-command-quality-eval`
**Created**: 2026-07-21
**Status**: Draft
**Input**: GitHub issue #505 — catch commands that write too much, waste time, or prompt wrongly

## User Scenarios & Testing

### User Story 1 - Score a finished spec's runtime quality (Priority: P1)

A maintainer who just ran the Companion pipeline on a spec points one checker at the spec's directory and gets a scannable verdict on two runtime-quality dimensions: did the commands write artifacts that balloon past the size a healthy run produces, and did the run waste time (untrusted step spans, a step far out of band, task finishes dumped in one burst). Today both are judged by eyeball; a verbosity or timing regression in a command body would ship unseen.

**Why this priority**: This is the measurement gap the issue names — without it, a command that regresses into verbosity or burst-journaling is invisible until a human happens to notice.

**Independent Test**: Run the checker against a committed completed spec (e.g. `specs/509-timing-capture`) and confirm it reports per-dimension rows with PASS/WARN/FAIL and exits cleanly; feed it a synthetic bloated artifact and confirm the verbosity row flags it.

**Acceptance Scenarios**:

1. **Given** a completed spec directory with artifacts inside their budgets and trusted timing, **When** the checker runs against it, **Then** every verbosity and timing row reports PASS and the exit code is success.
2. **Given** a spec whose `plan.md` is several times the healthy size, **When** the checker runs, **Then** the verbosity row for `plan.md` reports WARN inside the first band and FAIL past the outer band, naming the measured size and the budget.
3. **Given** a history where a pipeline step is missing its ordered start/complete boundary pair, **When** the checker runs, **Then** the timing report marks that step's span untrusted rather than silently scoring it.
4. **Given** a history where three or more AI task finishes land inside one second, **When** the checker runs, **Then** the burst-journaling row FAILs, since that is the pre-#509 end-of-step-dump shape.

### User Story 2 - Catch a command body that prompts wrongly (Priority: P1)

A maintainer editing the shipped command bodies runs a static prompting check. Commands under the never-halts contract (the after-step hooks, the living-spec reports and sync, mark-complete, status, resume, classify) must contain no instruction to stop and ask the user anything; the clarify-type step must ask. The check reads the command sources as text — no AI simulation — and understands negation, so "do not prompt the user with option tables" in the specify body is not a violation.

**Why this priority**: A prompt instruction slipping into a never-halts command breaks the family's core contract (a hook that stops to ask a question stalls every pipeline run); nothing guards that text today.

**Independent Test**: Run the checker in prompting mode against the shipped command directory and confirm it passes; plant a synthetic "ask the user before continuing" line in a copy of a hook body and confirm that file FAILs.

**Acceptance Scenarios**:

1. **Given** the shipped command bodies on main, **When** the prompting check runs, **Then** every never-halts command passes and the clarify-type command is confirmed to ask.
2. **Given** a never-halts command body containing an instruction to wait for a user answer, **When** the prompting check runs, **Then** that command FAILs with the offending line quoted.
3. **Given** a body whose only mention of prompting is negated ("do not prompt the user…"), **When** the prompting check runs, **Then** it passes.
4. **Given** a clarify-type body that no longer contains any ask-the-user instruction, **When** the prompting check runs, **Then** it FAILs — the command exists to ask.

### User Story 3 - Regressions surface in CI (Priority: P2)

CI runs the quality eval on every PR: the artifact/timing dimensions over the committed fixture specs that the current pipeline produced (`specs/509-timing-capture`, `specs/510-living-sync`), and the prompting dimension over the shipped command sources. A hard regression fails the job; judgment-call thresholds report as WARN without blocking.

**Why this priority**: The eval only prevents regressions if it runs where regressions land — but it depends on US1/US2 existing first.

**Independent Test**: The CI job runs the checker in strict mode over both fixtures and the command directory; a synthetic threshold breach in a test proves strict mode exits non-zero on FAIL while WARN alone stays green.

**Acceptance Scenarios**:

1. **Given** the committed fixture specs and command sources on a healthy branch, **When** CI runs, **Then** the quality steps pass.
2. **Given** a change that pushes a fixture artifact past a FAIL band or plants a prompt in a never-halts body, **When** CI runs in strict mode, **Then** the job fails naming the dimension.
3. **Given** a run that only crosses a WARN band, **When** CI runs, **Then** the WARN is visible in the log and the job stays green.

### Edge Cases

- A spec directory with no `.spec-context.json` or an empty/withered `history[]`: the timing dimension reports what it could not examine instead of scoring nothing as clean (no false-clean).
- A spec missing an artifact entirely (e.g. a fast-tracked spec whose `plan.md` is a one-line pointer): tiny artifacts are never flagged; only oversized ones are.
- A history with only a subset of pipeline steps (spec abandoned before implement): only reached steps are scored; unreached steps are not "untrusted".
- Fewer than three AI task finishes: the burst detector stays silent rather than judging a sample too small to mean anything.
- A command file the prompting roster names that does not exist on disk: the check fails loudly (a silently shrinking scan surface is the drift class this repo has been bitten by).
- Negation windows: "never ask", "rather than asking", "without prompting" must not count as prompt instructions.

## Requirements

### Functional Requirements

- **FR-001**: The eval MUST score a spec directory's `spec.md`, `plan.md`, and `tasks.md` against per-artifact size budgets with two bands — WARN (suspicious) and FAIL (regression) — with all budgets defined in one place in the checker.
- **FR-002**: Budget defaults MUST be derived from the real completed specs on main (spec ≈ 93–145 lines, plan ≈ 45–60, tasks ≈ 70–101 across 484/509/510), set so those specs pass with headroom while a severalfold balloon fails.
- **FR-003**: The eval MUST read `history[]` and mark each reached pipeline step's span trusted only when it carries an ordered extension-stamped start→complete boundary pair; untrusted spans are reported, not silently scored.
- **FR-004**: The eval MUST flag the burst-journaling shape — three or more AI task finishes clustered within one second — as FAIL, and flag a step duration far out of band relative to the run's other steps as WARN.
- **FR-005**: The eval MUST statically check command-body sources: every command on the never-halts roster contains no instruction to prompt/ask/wait for the user; the clarify-type command contains one; negated mentions do not count; a roster entry missing from disk is a loud failure.
- **FR-006**: The eval MUST run standalone from the repo (`--feature-dir` for artifact+timing, `--commands-dir` for prompting, both combinable), support `--json`, and support `--strict` where only FAIL affects the exit code — WARN never blocks.
- **FR-007**: CI MUST run the eval in strict mode over `specs/509-timing-capture`, `specs/510-living-sync`, and the shipped command directory, in the existing Python capture-suite job.
- **FR-008**: The checker MUST have stdlib-only unittest coverage including one failing-direction test per dimension (a synthetic bloated artifact, a synthetic burst history, a synthetic planted prompt) so the gate is proven to fail, not just to pass.
- **FR-009**: Documentation MUST land with the change: the eval skill's SKILL.md gains the quality-eval step, the spec-kit extension's CHANGELOG gains an `[Unreleased]` entry, and the capture-and-timing doc notes the new timing assertions.

### Key Entities

- **Quality report**: an ordered list of check rows, each `(severity: PASS|WARN|FAIL|INFO, id, detail)`, plus counts; rendered as text or JSON.
- **Budget table**: the single-place per-artifact `(warn, fail)` line thresholds.
- **Prompting roster**: the named sets of command files under the never-prompt contract and the must-ask contract.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Running the eval against `specs/509-timing-capture` and `specs/510-living-sync` produces zero FAIL rows.
- **SC-002**: Each dimension demonstrably catches its regression: a synthetic oversized artifact, a synthetic one-second task-finish burst, and a synthetic planted prompt each produce a FAIL row in tests.
- **SC-003**: The prompting check over the shipped command sources passes on main, and removing the ask from the clarify-type body or planting an ask in a hook body flips it to FAIL.
- **SC-004**: In strict mode the exit code is non-zero on any FAIL and zero when only WARN/PASS/INFO rows exist.
- **SC-005**: The eval needs nothing beyond the Python standard library and completes in seconds.

## Assumptions

- The eval lives alongside `check_capture.py` in the eval skill directory (dev-workspace tooling, not shipped in either extension package), with its tests in the spec-kit extension's Python test suite — the same split the existing evals and gates already use.
- Line counts are the primary budget unit; character counts ride along as a secondary signal for pathological single-line files.
- "Out of band" for step durations is a relative judgment (WARN tier), never a hard FAIL — wall-clock varies too much across machines and models to gate on.
- Bench integration beyond CI is out of scope for v1 and noted as follow-up in the PR.

## Verbatim Constraints

- New checker file: `check_quality.py`, runnable as `python3 .claude/skills/eval-speckit-extension/check_quality.py --feature-dir specs/<NNN>-<slug>`.
- CLI flags: `--feature-dir`, `--commands-dir`, `--json`, `--strict`.
- CI fixtures: `specs/509-timing-capture`, `specs/510-living-sync`.

## ADDED Requirements
<!-- capability: companion-commands -->

### The prompting contract is held by a static gate, not by convention

The commands under the never-halts contract — the four lifecycle hooks, the living-spec reports and sync, completion, status, resume, and classify — SHALL be scanned on every change for instructions that stop to ask the user, and the clarify-type carrier SHALL be required to ask. The scan reads the command sources as text (negated mentions and fenced templates do not count), and a roster file it cannot find fails loudly rather than shrinking the surface it checks.

#### Scenario: a prompt instruction slips into a never-halts command

- **WHEN** a command on the never-halts roster gains a non-negated ask-the-user instruction
- **THEN** the quality gate fails naming the command and quoting the offending line

#### Scenario: the clarify carrier stops asking

- **WHEN** the clarify-type command body no longer contains an ask instruction
- **THEN** the quality gate fails — asking is that command's purpose
