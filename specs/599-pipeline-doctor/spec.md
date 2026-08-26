# Feature Specification: Pipeline Doctor — Run Tracing, Debug Mode, and a Health Check

**Feature Branch**: `599-pipeline-doctor`
**Created**: 2026-08-25
**Status**: Draft
**Source**: [Issue #599](https://github.com/alfredoperez/speckit-companion/issues/599)

## Overview

Today a Companion run keeps no record of itself beyond what the AI remembers to write down. When something goes wrong — a spec stuck at one status while the pipeline bar refuses to offer the next step, a drift warning on every open that nobody can confirm, a spec that never lands as completed, a task file whose user-story sections were quietly renamed — there is no way to tell whether the records are wrong, the display is wrong, or the AI's claim about what it did was wrong. Script failures disappear into stderr, hooks leave no evidence they fired, and nothing measures where a run's time goes.

This feature gives every run a record of itself that costs nothing to keep, a health check that can be run at any time — including on specs created long before this feature existed — and that always recomputes reality rather than trusting a prior claim, plus a debug switch that adds deep timing detail only while it is turned on.

## User Scenarios & Testing

### User Story 1 - Diagnose an existing spec's run record (Priority: P1)

A developer has a spec that finished days ago and looks wrong: the header says one thing, the pipeline bar offers something else. They run a health check against that spec directory and get a plain-language verdict built entirely from what is already on disk — the run's recorded history and its files — with no need for the spec to have been created after this feature shipped.

**Why this priority**: This is the whole point of the feature and the only part that works retroactively on the specs that are causing pain right now. It needs nothing new to be recorded first, so it delivers value on the day it lands.

**Independent Test**: Run the health check against a spec directory created before this feature existed. It produces a verdict naming concrete findings (or a clean bill of health) without modifying anything.

**Acceptance Scenarios**:

1. **Given** a spec whose recorded history contains a step that started but has no matching finish, **When** the health check runs, **Then** it reports that step as unfinished and names it.
2. **Given** a spec whose task list has boxes checked that have no matching finish in the run record, **When** the health check runs, **Then** it reports those tasks as completed without a journal entry.
3. **Given** a spec whose task finishes are all clustered within a few seconds of each other at the end of a phase, **When** the health check runs, **Then** it reports batched journaling rather than treating the timings as real per-task durations.
4. **Given** a spec whose steps are attributed to an unexpected author (an AI closing a step only the extension is allowed to close, or the reverse), **When** the health check runs, **Then** it reports the attribution anomaly and names the step.
5. **Given** a spec whose status says one step is finished while the files and history say otherwise, **When** the health check runs, **Then** it states that the records disagree with each other and points at the capture path.
6. **Given** a spec whose records are internally consistent but whose display still refuses to advance, **When** the health check runs, **Then** it states that the records are consistent and points at the display instead.
7. **Given** a spec with no findings at all, **When** the health check runs, **Then** it reports a clean verdict and states which checks it was able to run.
8. **Given** any spec, **When** the health check runs, **Then** it changes no file in the spec directory.

---

### User Story 2 - Every capture call leaves a trace, including the ones that fail (Priority: P1)

A developer's run silently lost half its task journal. Today that failure is invisible. With an always-on self-trace, every call the capture and drift machinery handles — successful or not — writes one line to a local trace file, so the health check can later report how many calls were made, how many failed, and why.

**Why this priority**: Without this, the health check can only reason about what was successfully written; a failed call looks identical to a call that was never attempted. It is the difference between "something is missing" and "here is what broke and why."

**Independent Test**: Force a capture call to fail (point it at an unwritable spec directory), then run the health check. The failure appears in the report with its reason.

**Acceptance Scenarios**:

1. **Given** a normal run, **When** any capture call is handled, **Then** one trace line is recorded for it without the run making any additional call of its own.
2. **Given** a capture call that fails, **When** the health check runs afterwards, **Then** the failure is reported with the reason it failed.
3. **Given** a long-running project, **When** the trace file grows past its cap, **Then** it is bounded rather than growing without limit.
4. **Given** a repository, **When** a trace file is written, **Then** it is excluded from version control and never appears in a commit.
5. **Given** a run, **When** its trace is consumed by the health check, **Then** the report can state call counts, failure counts, payload sizes, and how many times each file was rewritten during the run.
6. **Given** a trace file that is missing or unreadable, **When** the health check runs, **Then** it reports the trace-derived sections as unavailable and still produces the record-derived verdict.

---

### User Story 3 - Judge a drift warning instead of guessing at it (Priority: P2)

The extension shows a drift warning every time a spec is opened, and nobody can tell whether it means anything. The health check recomputes drift itself, from scratch, and shows its work: which capability, which files changed since that capability's spec was last committed, and in which commits. Every flag is then classified so the developer can act.

**Why this priority**: Drift warnings that cannot be judged get ignored, which makes the whole drift feature worthless. This restores its credibility but depends on the health check existing first.

**Independent Test**: Open a spec that currently shows a drift warning, run the health check, and confirm the report names the exact capability, files, and commits behind the warning.

**Acceptance Scenarios**:

1. **Given** a project with living specs, **When** the drift audit runs, **Then** it recomputes drift from the deterministic ground truth rather than reading any previously recorded verdict.
2. **Given** a capability flagged as drifted, **When** the audit reports it, **Then** it lists the capability, the changed files, and the commits that changed them.
3. **Given** a flag whose only changed files are the companion's own bookkeeping writes, **When** the audit classifies it, **Then** it is reported as self-inflicted, not as real drift.
4. **Given** a flag produced by comparing against the wrong commit or by a file rename, **When** the audit classifies it, **Then** it is reported as a suspect baseline, not as real drift.
5. **Given** a run that recorded a claim of being drift-clean while recomputation finds drift, **When** the audit runs, **Then** the contradiction is reported as a false claim.
6. **Given** a capability whose baseline cannot be determined at all, **When** the audit reports it, **Then** it is reported as unknown with the reason, never as clean.

---

### User Story 4 - Find out why a spec never landed as completed (Priority: P2)

A developer marked a spec complete and it stayed stuck. The health check states the reason: the write never arrived, the write was refused (the wrong folder was targeted, or the spec was not in a state that allows completion), or the write landed and the display is what disagrees.

**Why this priority**: Silent completion failures strand finished work and are one of the reported symptoms, but the diagnosis rides on the health check's existing record reading.

**Independent Test**: Reproduce a completion failure with a deliberately broken fixture (a missing feature pointer, an unwritable record), run the health check, and confirm the report names the cause.

**Acceptance Scenarios**:

1. **Given** a spec where completion was attempted but no completion write reached the record, **When** the health check runs, **Then** it reports that the write never arrived.
2. **Given** a spec where the completion write was refused, **When** the health check runs, **Then** it reports the refusal and the reason for it.
3. **Given** a spec whose record does say completed while the display does not, **When** the health check runs, **Then** it reports the record as correct and the display as the disagreement.
4. **Given** a spec where completion was never attempted, **When** the health check runs, **Then** it says so rather than inventing a failure.

---

### User Story 5 - Catch a task file that was restructured mid-run (Priority: P2)

The task list is generated with a specific shape — one phase per user story, waves inside each phase, join lines between waves. Later steps execute that list but must never rewrite its structure. The health check verifies the shape survived and flags any step that renamed or flattened the story sections.

**Why this priority**: A restructured task file breaks progress counting and hides which user story work belongs to, but it is a narrower symptom than the record and drift problems.

**Independent Test**: Take a generated task file, replace its user-story phase headings with flat wave headings, and run the health check. It flags the file as a template violation.

**Acceptance Scenarios**:

1. **Given** a task file that still carries its generated user-story phases with waves inside them, **When** the health check runs, **Then** the template check passes.
2. **Given** a task file whose user-story phase headings were replaced by top-level wave headings, **When** the health check runs, **Then** it is flagged as a template violation and the offending headings are named.
3. **Given** a task file whose wave join lines or checkpoints were removed, **When** the health check runs, **Then** the missing structure is reported.
4. **Given** a spec with no task file, **When** the health check runs, **Then** the template check reports itself as not applicable rather than failing.

---

### User Story 6 - Turn on deep timing only while investigating (Priority: P3)

When a run's timing is the question, a developer sets a debug flag in the project's own configuration and re-runs a step. The command bodies are re-rendered with step-by-step timing instrumentation inlined. Turning the flag off re-renders them without it, so a normal run carries no trace of the instrumentation at all.

**Why this priority**: Valuable for deep investigation, but the always-on trace already answers most questions, and this must not cost anything when off.

**Independent Test**: Turn the flag on, re-render, and confirm the instrumentation is present in a command body; turn it off, re-render, and confirm the body carries no instrumentation text.

**Acceptance Scenarios**:

1. **Given** the debug flag is off, **When** a command body is inspected, **Then** it contains no instrumentation instructions of any kind.
2. **Given** the debug flag is turned on, **When** the bodies are re-rendered and one step is re-run, **Then** the run yields per-step timing detail.
3. **Given** the debug flag is turned back off, **When** the bodies are re-rendered, **Then** the instrumentation is absent rather than present-but-inactive.
4. **Given** a command is already running, **When** the debug flag changes, **Then** the change applies to the next dispatched command and not to the one in flight.
5. **Given** the configuration file is missing or unreadable, **When** commands are rendered, **Then** debug is treated as off and nothing fails.

---

### User Story 7 - Explain what actually happened from the session transcript (Priority: P3)

For a run where the record alone is not enough, the developer asks for a deep audit. The health check reads the AI session transcript covering that run's time window and explains causes: what was tried and failed, what was retried, what was never attempted. It surfaces claims the AI made that contradict recomputed reality, and measures wasted output — extra summaries, narration, the same file rewritten repeatedly.

**Why this priority**: The most powerful diagnosis available, but it depends on a transcript format that is not a stable contract and only exists for some providers, so it is a builder's tool rather than a product promise.

**Independent Test**: Run the deep audit on a completed run performed by a provider that keeps transcripts, and confirm it reports causes and output waste. Run it on a provider without transcripts and confirm it exits cleanly with a one-line notice.

**Acceptance Scenarios**:

1. **Given** a completed run whose transcript is available, **When** the deep audit runs, **Then** it distinguishes work that was tried and failed from work that was retried and from work that was never attempted.
2. **Given** a run whose recorded claim contradicts the recomputed reality, **When** the deep audit runs, **Then** the contradiction is surfaced with both sides shown.
3. **Given** a run with repeated rewrites of the same file, **When** the deep audit runs, **Then** the waste is quantified.
4. **Given** a provider that keeps no transcript, **When** the deep audit is requested, **Then** it reports one line saying it is not available and exits successfully.
5. **Given** a transcript whose format has changed and can no longer be parsed, **When** the deep audit runs, **Then** it degrades to a notice rather than failing the command.

---

### User Story 8 - Prove failures get recorded, not just happy paths (Priority: P3)

The measurement harness runs the tracer in its own comparison folders and folds the health check's verdict into its scoring. A deliberately oversized variant with many files and a long task list makes batched journaling reproducible, and a failure-injection fixture proves a broken capture leaves a record rather than vanishing.

**Why this priority**: Confidence that the feature works under stress, but it validates the other stories rather than adding user-facing capability.

**Independent Test**: Run the harness over the oversized variant and confirm the scoring reflects the health check's verdict, including a batched-journaling finding when journaling was in fact batched.

**Acceptance Scenarios**:

1. **Given** the harness folders, **When** a run completes in them, **Then** a trace is produced for that run.
2. **Given** a completed harness run, **When** scoring is computed, **Then** the health check's verdict contributes to the score.
3. **Given** the oversized variant, **When** a run journals its tasks in a single end-of-phase burst, **Then** the harness surfaces the batched journaling.
4. **Given** the failure-injection fixture, **When** capture is made to fail, **Then** the failure is recorded and reported rather than silently lost.

---

### User Story 9 - Catch a step doing the next step's work (Priority: P2)

Each step in the pipeline has a job, and the value of the pipeline comes from each one stopping where it stops. In practice a step bleeds: specify starts naming files and dependencies, plan starts writing a task checklist, tasks starts writing the implementation. Nobody notices, because every artifact still looks plausible on its own — the cost shows up later as duplicated work, a step that took three times as long as it should have, and two artifacts that now disagree. The health check reads the artifacts and the run's own timing and reports where one step did another's work.

**Why this priority**: This is the pipeline's most expensive silent failure — it is what makes a run feel slow without any single step looking wrong. It is decidable from the artifacts already on disk, so like the rest of the doctor it works retroactively.

**Independent Test**: Take a spec whose plan document contains a task checklist, run the health check, and confirm it reports plan as having done tasks' work, naming the evidence.

**Acceptance Scenarios**:

1. **Given** a specification that carries a task checklist or a file-by-file breakdown, **When** the health check runs, **Then** it reports the specification as having done planning or tasking work, and names what it found.
2. **Given** a plan document that carries a task checklist, **When** the health check runs, **Then** it reports planning as having done tasking work.
3. **Given** a task list that carries substantial implementation code rather than task descriptions, **When** the health check runs, **Then** it reports tasking as having done implementation work.
4. **Given** the same task identifiers appearing in two different artifacts, **When** the health check runs, **Then** the duplication is reported with the artifacts named, because two copies of one list will diverge.
5. **Given** source files committed while the run was still in a step before implement, **When** the health check runs, **Then** those files and their commits are reported as implementation done early.
6. **Given** a step before implement that consumed a larger share of the run than implement itself, **When** the health check runs, **Then** the disproportion is reported as a signal worth looking at, not as a defect in itself.
7. **Given** a small change deliberately fast-tracked, where the specification legitimately carries its approach inline and the plan is a pointer, **When** the health check runs, **Then** none of that is reported as bleed.
8. **Given** artifacts that each stay within their own step, **When** the health check runs, **Then** the check reports clean.

---

### Edge Cases

- A spec directory with no run record at all — the health check must report which checks it could not run, not a clean verdict.
- A run record whose history is empty or contains only a start — the earliest possible state must not be reported as a defect.
- A spec whose record is not valid at all (hand-edited into invalid shape) — the health check must name the corruption rather than crash.
- A repository with no version-control history, or a shallow clone — drift baselines cannot be computed, and every affected capability must report unknown with the reason.
- A trace file that is partially written or truncated by a crash — readable lines are used, the unreadable tail is reported as skipped.
- Two runs of the same spec on different days — the report must not confuse one run's timing with another's.
- The health check run on a spec that is currently mid-run — in-flight steps must read as in progress, not as dangling.
- A project that has never enabled living specs — the drift audit reports itself as not applicable rather than as clean or as failing.
- The trace file and the run record disagreeing about the same event — the report must state the disagreement rather than pick a winner silently.
- A task file that legitimately contains only one user story — a single phase must not be mistaken for a flattened file.
- A specification for a change deliberately fast-tracked as small — its inline approach section and pointer plan are correct, not bleed, and must not be flagged.
- A specification that pins exact identifiers the request supplied — those are requirements, not implementation detail leaking in.
- A run whose steps were executed out of order or re-run — step time shares must be computed from the recorded boundaries, not assumed sequential.

## Requirements

### Functional Requirements

- **FR-001**: The system MUST provide a read-only health check that can be run against any spec directory at any time and MUST NOT modify any file it inspects.
- **FR-002**: The health check MUST produce a meaningful verdict for a spec created before this feature existed, deriving its findings from the run record and the on-disk files alone.
- **FR-003**: The health check MUST report any step whose start has no matching finish, naming the step.
- **FR-004**: The health check MUST report any task marked done in the task list that has no matching finish in the run record.
- **FR-005**: The health check MUST detect task finishes clustered into a single burst and report them as batched journaling rather than as measured per-task durations.
- **FR-006**: The health check MUST report attribution anomalies — a step closed by an author that is not the one the pipeline reserves for that step.
- **FR-007**: The health check MUST classify the "status says one thing, the pipeline bar offers another" symptom as either "the records disagree with each other" (a capture defect) or "the records are consistent" (a display defect).
- **FR-008**: The health check MUST state which checks it ran and which it could not run, and MUST NOT report a clean verdict for checks it skipped.
- **FR-009**: The health check MUST exit successfully whatever it finds; a finding is a report, never a gate that blocks a pipeline.
- **FR-010**: The capture runtime MUST record one trace entry for every call it handles, including calls that fail, without requiring any additional call from the run.
- **FR-011**: A failed capture call MUST leave a trace entry carrying the reason it failed.
- **FR-012**: The trace MUST be stored locally per spec, excluded from version control, and capped in size so it cannot grow without bound.
- **FR-013**: Writing a trace entry MUST NOT measurably slow a run and MUST NOT add any instruction text to a command body.
- **FR-014**: The health check MUST consume the trace to report call counts, failure counts, payload sizes, loaded-context sizes, and per-file rewrite counts.
- **FR-015**: The drift audit MUST recompute drift itself from the deterministic ground truth and MUST NOT trust any previously recorded drift verdict.
- **FR-016**: The drift audit MUST show its work for each flag: the capability, the files changed since that capability's spec was last committed, and the commits that changed them.
- **FR-017**: The drift audit MUST classify each flag as real drift, self-inflicted (caused by the companion's own writes), or suspect baseline (wrong comparison point, renames).
- **FR-018**: The drift audit MUST report a recorded claim of drift-clean that contradicts its own recomputation as a false claim.
- **FR-019**: The drift audit MUST report a capability whose baseline cannot be determined as unknown with the reason, never as clean.
- **FR-020**: Drift evaluations MUST record their own inputs to the trace so repeated verdicts can be compared over time.
- **FR-021**: When completion was attempted but the spec did not reach the terminal state, the health check MUST state which of these happened: the write never arrived, the write was refused (and why), or the write landed and the display disagrees.
- **FR-022**: The health check MUST distinguish "completion was never attempted" from "completion failed".
- **FR-023**: The health check MUST verify the task list still carries its generated shape — one phase per user story, waves inside each phase, join lines and checkpoints intact.
- **FR-024**: The health check MUST flag a task list whose user-story sections were renamed, flattened, or replaced after generation as a template violation, naming the offending headings.
- **FR-025**: The system MUST provide a debug switch in the project's own companion configuration file, not as an editor setting.
- **FR-026**: When the debug switch is off, command bodies MUST contain no instrumentation text at all — absent, not dormant.
- **FR-027**: When the debug switch is on, re-rendered command bodies MUST carry step-by-step timing instrumentation that yields per-step timing on the next run.
- **FR-028**: A change to the debug switch MUST affect the next dispatched command and MUST NOT alter a command already in flight.
- **FR-029**: The health check MUST offer an optional deep audit that reads the AI session transcript covering the run's time window.
- **FR-030**: The deep audit MUST distinguish work that was tried and failed, work that was retried, and work that was never attempted.
- **FR-031**: The deep audit MUST surface claims recorded during the run that contradict the recomputed reality.
- **FR-032**: The deep audit MUST quantify wasted output, including extra summaries, narration, and repeated rewrites of the same file.
- **FR-033**: The deep audit MUST degrade to a single "not available" line and exit successfully where no transcript exists or its format can no longer be parsed.
- **FR-034**: The measurement harness MUST produce a trace for runs performed in its comparison folders and MUST fold the health check's verdict into its scoring.
- **FR-035**: The harness MUST include a deliberately oversized variant large enough to surface batched task journaling when it occurs.
- **FR-036**: The harness MUST include a failure-injection fixture that proves a failed capture is recorded and reported rather than lost.
- **FR-037**: Existing capture, drift, and completion behavior MUST be unchanged for a user who never runs the health check and never turns debug on.
- **FR-038**: Every part of this feature MUST inherit the runtime's never-fail-the-host contract: a missing interpreter, an unreadable file, or an unresolvable directory reports the problem and continues, never halting the pipeline.
- **FR-039**: The closing of a task SHOULD be reducible to a single call rather than the current pair of calls, without changing what is recorded.
- **FR-040**: The end-of-step capture calls SHOULD be reducible to a single batched call rather than a volley of separate calls, without changing what is recorded.

- **FR-041**: The health check MUST report a specification that carries planning or tasking content — a task checklist, or a file-by-file breakdown — and name the evidence it found.
- **FR-042**: The health check MUST report a plan document that carries a task checklist as planning having done tasking work.
- **FR-043**: The health check MUST report a task list that carries substantial implementation code as tasking having done implementation work.
- **FR-044**: The health check MUST report the same task identifiers appearing in more than one artifact, naming the artifacts.
- **FR-045**: The health check MUST report source files committed while the run was still in a step before implement, naming the files and their commits.
- **FR-046**: The health check MUST report a step before implement that consumed a larger share of the run than implement itself, as a signal rather than as a defect.
- **FR-047**: The health check MUST NOT report a deliberately fast-tracked small change as bleed when its specification carries its approach inline and its plan is a pointer.

### Key Entities

- **Run record** — the durable per-spec account of a run: which step it is on, its status, and an append-only history of step and task events with their authors and timestamps. Already exists; this feature reads it and never rewrites it.
- **Trace entry** — one line describing a single handled call: which operation, whether it succeeded, why it failed if it did, how large its payload was, and which file it touched. Local to the project, never committed, size-capped.
- **Finding** — one item in the health check's report: a category (unfinished step, unjournaled task, batched journaling, attribution anomaly, records-vs-display, drift, completion, template), the evidence behind it, and a plain-language statement of what it means.
- **Drift flag** — a per-capability verdict pairing what was recomputed with how it is classified (real, self-inflicted, suspect baseline, unknown) and the files and commits behind it.
- **Debug switch** — a project-level setting whose only effect is which version of the command bodies gets rendered.
- **Harness variant** — a comparison folder configuration, including the oversized variant and the failure-injection fixture, whose scoring now includes the health check's verdict.
- **Bleed signal** — one piece of evidence that a step did another step's work: which step, which step's work it did, what was found (a task checklist, a code block, a duplicated identifier, an early source commit, a disproportionate time share), and where.

## Success Criteria

### Measurable Outcomes

- **SC-001**: A run with tracing on completes in the same time as one without it, within normal run-to-run variation, and its command bodies are byte-identical to the pre-feature bodies while debug is off.
- **SC-002**: The health check produces a non-empty, actionable verdict for 100% of spec directories that contain a run record, including every spec created before this feature existed.
- **SC-003**: 100% of capture calls that fail leave a trace entry naming the reason, verified by the failure-injection fixture.
- **SC-004**: For the status-versus-display symptom, the health check returns one of exactly two verdicts — records disagree, or records consistent — and never leaves the cause unstated.
- **SC-005**: For every drift warning shown, the health check lists the specific capability, files, and commits behind it, so a developer can decide in under a minute whether the drift is real.
- **SC-006**: A drift flag whose changed files are entirely the companion's own writes, or whose comparison point is wrong, is classified as a false alarm in 100% of the fixture cases covering those shapes.
- **SC-007**: A recorded drift-clean claim contradicted by recomputation is reported as a false claim in 100% of cases where the two disagree.
- **SC-008**: Every completion failure reproduced by the fixtures yields a stated reason rather than a silent stall.
- **SC-009**: A task list whose user-story sections were renamed or flattened is flagged in 100% of the fixture cases.
- **SC-010**: The report states a rewrite count for every file rewritten more than once during a run.
- **SC-011**: Turning debug on and re-running one step yields per-step timing; turning it off leaves zero instrumentation text in the rendered bodies, verified by a text comparison.
- **SC-012**: The deep audit produces causes and a waste figure on a run recorded by a transcript-keeping provider, and exits successfully with a single notice on providers without transcripts.
- **SC-013**: A harness run over the oversized variant surfaces batched task journaling whenever journaling was in fact batched, with no false positive on a variant that journaled per task.
- **SC-014**: Users who never run the health check and never turn debug on observe no change in capture, drift, or completion behavior.
- **SC-015**: For each of the five bleed shapes — a specification doing plan work, a plan doing task work, a task list doing implementation work, an identifier duplicated across artifacts, and source committed before implement — the health check reports it in 100% of the fixture cases, with zero findings on a clean run and zero on a deliberately fast-tracked small change.

## Assumptions

- The health check is a new read-only command in the Companion family, discoverable the same way the existing living-spec commands are; it is not wired into any gate and never blocks a pipeline.
- The health check reports; it does not repair. Fixing a finding is a separate, deliberate act.
- The trace is a builder's diagnostic and a local artifact only — it is never uploaded, never committed, and carries no telemetry contract.
- "Recent" for the trace means whatever fits under the size cap; older entries roll off rather than being archived.
- The deep audit is Claude-first. Transcript layout and format are treated as unstable, so the audit is documented as a builder's tool rather than a supported product surface.
- Debug mode's instrumentation is delivered by re-rendering command bodies through the existing assembly pipeline; the switch does not introduce a second way to change command text.
- Both quick wins (a single-call task close, a single batched end-of-step capture) preserve exactly what is recorded today; they change the number of calls, not the record.
- The oversized harness variant is a new variant alongside the existing ones, not a replacement for any of them.
- Step bleed is reported, never blocked. A run that bleeds still produces working software; the point is to make the cost visible, not to fail the pipeline over it.
- The time-share signal is a note rather than a problem, because a genuinely hard planning phase is a legitimate reason for a long plan step. It earns attention only alongside the artifact evidence.

## Verbatim Constraints

These values were pinned by the request and MUST be used exactly as written:

- Trace file path: `specs/NNN/.trace.jsonl`
- Debug flag: `debug: true` in `.specify/companion.yml`
- Deep-audit flag: `--chat`
- Batched end-of-step capture flag: `--batch`
- Existing task-close flags being merged: `--append` and `--materialize`
- Self-trace hosts: `write-context.py` and `drift.py`
- Drift ground truth: `.specify/extensions/companion/scripts/drift.py`
- Task-shape baseline document: `speckit-extension/nodes/tasks/tasks-doc.md`
- Wave join line marker: `⟶ Wait`
- Transcript location for `--chat`: `~/.claude/projects/`
- Harness location: `examples/todo-claude/bench`
- Harness scoring entry point: `/bench-capture`
- Failure-injection fixture conditions: missing `feature.json`, unwritable context

---

## ADDED Requirements
<!-- capability: capture-runtime -->

### Every handled call records itself, including the ones that fail

Every script in this runtime returns success on failure by design, printing its reason to stderr and discarding it — the contract that keeps a capture defect from halting a user's pipeline, and the reason capture failures are invisible. Each script SHALL therefore append one line per handled call to a local, per-spec, size-capped trace: which operation, whether it did what it was asked, and — when it did not — the reason verbatim from the message it already printed. The record MUST cost no additional call and add no instruction text to any command body, so it is written from inside the scripts the pipeline already runs. A call that could not resolve a spec at all MUST still be recorded, in a repository-level unattributed log, because that failure is the most common one there is and dropping it would hide exactly what the trace exists to catch. Writing a trace entry MUST NEVER raise: it runs on paths that are already failing, so a tracer that could raise would turn a recorded problem into a crash.

#### Scenario: a capture call is declined
- **WHEN** a call is refused and its reason printed to stderr
- **THEN** a trace entry records the call as not ok, carrying that reason verbatim

#### Scenario: the spec cannot be resolved
- **WHEN** a call cannot determine which spec it belongs to
- **THEN** the entry lands in the repository-level unattributed log rather than being dropped

#### Scenario: the trace cannot be written
- **WHEN** the trace file's directory is unwritable
- **THEN** the observed call completes exactly as it would have with no trace

### A call count may shrink only when the record it produces stays identical

Reducing the number of calls a step makes is worth doing — the two-call task close and the six-call end-of-step volley are both mostly ceremony — but a shorter path that records something different is a regression disguised as an optimization. A merged form MUST therefore produce a record byte-equivalent to the sequence it replaces, MUST remain idempotent for the same reason the sequence was, and MUST NOT remove the caller's ability to perform the steps separately where the split exists for a reason: only the main agent may fold, so a merged close that folds is for the main agent alone and a fanned-out worker keeps appending on its own.

#### Scenario: a task is closed in one call instead of two
- **WHEN** the merged close runs
- **THEN** the resulting record equals what appending and then folding produced

#### Scenario: a worker uses the merged close
- **WHEN** concurrent workers would each fold
- **THEN** the merged form is documented and reserved for the single serializing agent

## ADDED Requirements
<!-- capability: companion-commands -->

### A diagnostic command recomputes reality rather than trusting what a run recorded

Where a command reports on the health of a run, it MUST derive its answer by recomputing, never by reading back a verdict the run recorded about itself — a run that claimed it was clean is precisely the case worth checking. Such a command SHALL be read-only, SHALL always exit successfully, and SHALL isolate each of its checks so that one failing becomes that check's stated skip reason rather than taking the report down. It MUST report, for every check it knows about, whether that check ran, was skipped with a reason, or did not apply, so that "found nothing" and "could not look" can never print the same way. Its core checks MUST derive from the durable record and the on-disk documents alone, so that it produces a meaningful verdict on a run that finished long before the command existed.

#### Scenario: a recorded claim contradicts the recomputation
- **WHEN** a run recorded that an area was clean and recomputing finds otherwise
- **THEN** the contradiction is reported as a false claim, showing both sides

#### Scenario: a check cannot run
- **WHEN** the input a check needs is missing
- **THEN** it is reported as skipped with the reason, never as clean

### Optional instrumentation is delivered by re-rendering the bodies, never left dormant in them

A switch that adds instruction text to command bodies MUST change which bodies get rendered, not toggle a passage inside them. With the switch off the text MUST be absent from the assembled body entirely, so an off render stays byte-identical to the frozen baseline and the parity gate keeps its meaning. The switch SHALL be declared in the project's own configuration and read through the existing loader, inheriting its failure table, and it MUST NOT introduce a second mechanism for changing command text. Because a body is a static file the agent reads, the switch necessarily affects the next dispatched command and never one already in flight.

#### Scenario: the switch is off
- **WHEN** the bodies are assembled
- **THEN** they contain no instrumentation text and match the frozen baseline byte for byte

#### Scenario: a parity gate runs while the switch is on locally
- **WHEN** the gate assembles the bodies to compare them
- **THEN** it compares the off render, so a local switch can never fail the gate
