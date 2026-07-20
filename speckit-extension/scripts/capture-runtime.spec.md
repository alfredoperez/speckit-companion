# Capture Runtime — Living Spec

> [DRAFT] Surface-first draft from existing code — every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

The capture runtime is the set of Python scripts that turn an AI-driven spec-kit run into a durable, trustworthy record on disk — what step the spec is on, when each step and task really finished, what the run decided, and how those decisions fold back into long-lived living specs. Without it the extension is blind: it dispatches command text and receives no completion callback, so anything it cannot read from a file it does not know. And because these scripts run *inside* the user's own pipeline, a bug here does not merely lose data — it can break the run it was supposed to observe.

## Requirements

### Recording state MUST NOT be able to break the run it observes

Every script in this runtime is a passenger on the user's command. A missing interpreter, an unresolvable spec directory, a malformed config, a git repository that cannot answer a question — none of these MUST fail the host command. The scripts SHALL report the problem on stderr and exit successfully, so a capture defect degrades into a gap in the record rather than a halted pipeline. The read-side and report-side tools (status resolution, drift, coverage) carry the same contract and are documented as never raising and never exiting non-zero.

#### Scenario: the interpreter is absent
- **WHEN** a command reaches its capture step in an environment without `python3`
- **THEN** the command warns once and continues its real work
- **AND** the user's run completes normally with an incomplete record

#### Scenario: the spec directory cannot be resolved
- **WHEN** the writer cannot determine which spec a lifecycle write belongs to
- **THEN** it declines to write, names the problem on stderr, and exits successfully

### The context file is append-only, crash-safe, and tolerant of fields it does not own

The spec context is a shared document written by several independent producers — this runtime, the VS Code extension, and future readers. Writers SHALL read-merge-write rather than rebuild: unknown top-level keys and previously written history entries survive untouched, and the lifecycle log is only ever appended to, never rewritten or shrunk. Every write MUST be atomic (write a temporary file, then rename) so an interrupted run can never leave a half-written or truncated context behind.

#### Scenario: a newer writer adds a field this runtime does not know
- **WHEN** an older script updates a context file carrying an unfamiliar top-level key
- **THEN** that key is present and unchanged after the write

#### Scenario: the process dies mid-write
- **WHEN** a write is interrupted before it completes
- **THEN** the on-disk context is either the previous state or the new state, never a partial one

### Lifecycle status moves forward only, and the terminal state has exactly one writer

Any path that sets a spec's status MUST check that the spec has not already moved past the step being written, not merely that it is non-terminal. Re-running an earlier step, or a hook firing twice, records the finish but MUST NOT drag the spec backwards. Promotion to the terminal completed state is reserved to a single explicit writer (`--mark-complete`), which refuses a spec with work outstanding and is a no-op on a spec already shipped. Generic field-setting MUST refuse lifecycle keys outright, so no side door exists around this guard.

#### Scenario: an earlier step is re-advanced
- **WHEN** an already-advanced spec receives a completion for a step it passed
- **THEN** the finish is recorded in history
- **AND** the status and current step are left where they were

#### Scenario: a caller tries to set the terminal status through a generic setter
- **WHEN** a generic field write names a lifecycle key
- **THEN** the write is refused and the refusal is reported

### Timing is stamped by a script, never hand-authored

Durations are only meaningful if a clock produced them. Every timing entry SHALL be written by running a writer script that reads the real clock at write time; no caller — human or AI — writes timing into the context by editing the file. This is the runtime's central reliability lever: running a command is something an AI does faithfully, while pausing mid-work to hand-author a timestamped JSON entry is not. It is also what keeps the file structurally valid, since hand-editing is what corrupted it in practice.

#### Scenario: a step's work finishes
- **WHEN** the step's own work ends and its completion must be recorded
- **THEN** the writer script is invoked and stamps the entry from its own clock

#### Scenario: an entry is de-duplicated
- **WHEN** the same step completion is recorded twice
- **THEN** history carries it once

### Per-task progress is finish-only, contention-free, and folded idempotently

A task records a single finish, never a start/finish pair stamped at one instant — a pair produces zero-length ticks and hides real cadence, so each task's duration is the gap to the previous finish. Finishes are appended as single lines to a separate event log rather than read-modify-written into the shared context, so concurrent workers never contend and the hot loop never stalls. Those lines are folded into the durable record through the same code path a live write would take, so folding is byte-equivalent to inline journaling and re-folding the whole log never double-counts.

#### Scenario: several workers finish at once
- **WHEN** parallel workers each record a task finish simultaneously
- **THEN** every finish lands and none corrupts the shared context

#### Scenario: the log is folded more than once
- **WHEN** the same event log is folded repeatedly
- **THEN** the durable record is unchanged after the first fold

#### Scenario: the append log is garbage-collected
- **WHEN** the spec reaches its terminal state
- **THEN** pending lines are folded first and only then is the log removed
- **AND** the terminal state prevents the log from being recreated

### Derived artifacts have exactly one writer

Anything computed from the journal — most visibly the task checklist's checkboxes — SHALL be written by one place, derived from the event record, and never hand-edited by the agent doing the work. Two producers of the same fact will disagree eventually; making the checklist *derived* rather than a second source of truth is what keeps the file and the record from diverging. Task-marker parsing MUST accept every marker format the shipped command families emit, since a format the parser silently misses produces no journal at all and strands the step.

#### Scenario: a task is completed by a fanned-out worker
- **WHEN** a worker finishes its task
- **THEN** it records only its finish
- **AND** the checkbox is flipped later by the single derivation pass

### The spec a write lands on is resolved by a fixed precedence, and a conflict refuses rather than guesses

Several signals can name the active spec, and they can disagree — especially when a later spec is "active" while an earlier one is being settled. The runtime SHALL apply one documented precedence, and where a caller supplies a signal that is authoritative for the operation (the task list being synced names its own spec), that signal MUST override the ambient pointers. When two explicit signals conflict, the writer MUST refuse to write and name the mismatch, rather than silently picking one and settling the wrong spec.

#### Scenario: two explicit signals disagree
- **WHEN** an explicit spec directory and an explicit task list point at different specs
- **THEN** nothing is written and the mismatch is reported

#### Scenario: an older spec settles while a newer one is active
- **WHEN** a task list belonging to an earlier spec is synced
- **THEN** the earlier spec settles, regardless of which spec the ambient pointers name

### Additive capture composes; lifecycle modes are exclusive

The runtime distinguishes two kinds of write. Additive capture — decisions, verifications, concerns, expectations, requirement coverage, step summaries, size classification — SHALL all take effect when passed together, each reporting itself, because they are independent facts about the same run. Lifecycle modes are alternative readings of one invocation and MUST stay first-match-wins. When a capture flag accompanies a lifecycle flag, the lifecycle write is skipped and named on stderr rather than half-performed. All additive capture is de-duplicated on its identity value, so re-running a command never doubles up.

#### Scenario: several capture facts arrive in one call
- **WHEN** a caller records a decision, a verification, and a summary together
- **THEN** all three are stored

#### Scenario: capture and a lifecycle transition are mixed
- **WHEN** a completion flag and a capture flag arrive in one call
- **THEN** the capture is applied and the skipped lifecycle write is reported

### Folding a feature spec's requirement deltas into a living spec is idempotent for every verb combination

At completion, a feature spec's requirement deltas become part of the durable living spec. Re-applying the same delta set to its own output MUST be a byte-for-byte no-op — for a single verb, for any ordered pair, and for any combination. Verbs SHALL apply in a fixed pipeline order regardless of the order they appear in the document, and an addition MUST resolve its heading through the delta set's own renames before deciding whether that section already exists. A rename chain that loops back on itself names no destination and its entries are dropped as unsatisfiable rather than applied.

#### Scenario: a delta set both adds and renames the same heading
- **WHEN** the set is folded a second time
- **THEN** the living spec is unchanged and no section is duplicated

#### Scenario: the same heading is both added and modified
- **WHEN** the fold resolves the conflict
- **THEN** the modified body wins over the added body

### A probe that cannot determine an answer MUST report "unknown", never the negative

Boundary and capability probes throughout this runtime — is this a shallow clone, is this directory a separate project, does this file exist — MUST distinguish "no" from "I could not tell." Only the error that genuinely *means* absence may return the negative; every other failure MUST surface a third state so the caller can skip loudly. The failure shape this guards against is that the negative branch is usually also the keep-going branch, so a swallowed error silently produces a confident wrong answer.

#### Scenario: history is unreachable
- **WHEN** a shallow clone means a capability's baseline cannot be compared
- **THEN** that capability is reported as skipped with the reason, not as in sync

#### Scenario: a nested config is unreadable
- **WHEN** a boundary probe cannot read a directory's config
- **THEN** the directory is still treated as a boundary rather than descended into

### A report MUST NOT claim success for work it did not do

Summary output SHALL state both what was examined and what was not. A run that skipped every capability reports zero checked rather than a clean verdict, and a partly-skipped run states both counts so a success marker can never read as a verdict on the whole configuration. Skips carry their reason, and reasons that are actionable carry a hint. Reporting tools always exit successfully — a finding is a signal for a surrounding workflow to act on, not a gate these commands enforce.

#### Scenario: some capabilities could not be checked
- **WHEN** a drift run examines part of the configured set
- **THEN** the summary names both the checked and unchecked counts and the reason

### Living-spec path resolution stops at a nested project boundary

A directory carrying its own companion config is a separate project. Discovery SHALL stop there and never report, claim, or promote anything inside it — otherwise a sample or vendored project nested in the tree gets its specs attributed to the parent. Resolution is the single source of these rules; the sync, fold, drift, and coverage tools call it rather than re-interpreting the configuration themselves.

#### Scenario: a sample project is nested in the tree
- **WHEN** discovery walks into a directory holding its own companion config
- **THEN** the walk stops and nothing inside is reported as the parent's

### Each product ships every module its own entry points reach

This repository ships two products from one tree, and each has its own list of files to include. The two lists are deliberately different sizes: a product's list MUST carry the modules ITS entry points need, and no list is obliged to match the other. What is not optional is closure — a module that a runtime script imports MUST appear on the list of every product that ships that script, or a released build dies on first use while every gate stays green. Modules SHALL be imported by plain name rather than loaded dynamically, precisely so a packing gate can derive what ships by following imports to a fixed point; a dynamically loaded module is invisible to it.

Where a capability is deliberately left out of one build, attempting it MUST report clearly that it is unavailable in this context. A missing module SHALL NOT degrade into a silent no-op that reports success while doing nothing.

#### Scenario: a script gains a new import
- **WHEN** a runtime script starts importing a new sibling
- **THEN** every product that ships that script names the new module on its own list before release

#### Scenario: a build omits a capability on purpose
- **WHEN** something asks that build to perform it
- **THEN** it fails loudly with an explanation that the capability is unavailable here
- **AND** it does not quietly do nothing and report success

#### Scenario: a module is loaded by file path instead of imported
- **WHEN** the archive gate derives the shipping closure
- **THEN** the dynamically loaded module is not discovered and the archive is incomplete

## Uncovered

- `check-coverage.py` — read only its contract docstring, not its matching logic.
- `relocate-capability.py` — read only its opening docstring.
- `register-capability.py` — read only its contract docstring.
- `companion_config.py` — read its contract docstring and failure table, not its YAML reader.
- `status-context.py` — read its docstring and function list, not its resolution logic.
- `derive-from-files.py` — read its docstring only.
- `capture-golden.py`, `assemble-nodes.py`, `build-commands.py`, `check-shape-parity.py`, `_command_parts.py` — build-time tooling, covered by the companion-commands spec rather than here.
- The Python test suite under `speckit-extension/tests/` was not read.
