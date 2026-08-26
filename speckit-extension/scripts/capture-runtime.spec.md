# Capture Runtime — Living Spec

> Adopted from existing code on 2026-07-19. Requirements describe observed behavior and have not been individually verified against tests.

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

### The fold routes each capability's requirements to its own spec

A feature spec may declare a delta block per capability, each marked `<!-- capability: <name> -->`. The fold applies to each capability only the requirement units marked for it, plus unmarked units when that capability is the changed-files-matched default. A requirement marked for one capability never lands in another capability's spec.

#### Scenario: two blocks marked for different capabilities

- **WHEN** a completing feature's spec carries an `ADDED` block marked for capability A and another marked for capability B
- **THEN** A's spec receives A's requirement only, B's spec receives B's requirement only, and both names are recorded on `livingSpecs.synced`

#### Scenario: an unmarked block on a multi-capability fold

- **WHEN** a block carries no capability marker
- **THEN** it folds into the capability the changed files resolved to, and not into any marker-routed capability

### The drift detector offers an opt-in working-tree mode

The drift script SHALL accept a working-tree mode that widens each capability's changed set from committed history to the baseline→worktree diff plus untracked files, de-duplicated, with the tracked-vs-unspeced scan widened the same way. The default invocation issues exactly the pre-existing git commands and renders identical human output; the machine-readable result names which mode produced it. The never-fails exit contract and the checked/skipped counts semantics hold in both modes.

#### Scenario: an uncommitted edit in a capability's area
- **WHEN** drift runs without the flag and then with it
- **THEN** the default run reads the capability as in sync and the working-tree run reports the file as drifted

### Recording which living specs cover a change MUST be deterministic, not AI-judged

The capture runtime SHALL provide a script that, given a feature directory and the changed files, reads the living-specs registry, gates on `enabled: true`, runs the shipped resolver to find the capabilities that own those files, and records their names (most-specific first) onto `livingSpecs.loaded`. The specify command bodies call this script instead of asking the model to gate-and-decide, so the record cannot be lost to a misjudged "not configured." Like every capture script it is best-effort, opt-in, and read-only: any miss is a silent no-op that exits successfully. The recorder also returns its own outcome — `loaded`, `no-match`, or `not-configured` — and writes a deterministic `last_action` breadcrumb from that outcome, so the one-line audit trail the specify command used to ask the AI to author is now derived from what the script actually did rather than the model's reading of it. This is what stops "correctly did nothing" from being misjudged as "not configured."

#### Scenario: an enabled registry with a matching change
- **WHEN** the recorder runs with changed files a configured capability owns
- **THEN** `livingSpecs.loaded` lists the matched capabilities most-specific first
- **AND** the command is never failed or slowed by the recording

#### Scenario: the feature is off or nothing matches
- **WHEN** the registry is absent or disabled, or no capability owns the changed files
- **THEN** the recorder writes nothing and exits successfully

#### Scenario: the recorder writes its own audit breadcrumb
- **WHEN** the recorder finishes — whether it matched, found no match, or found the feature not configured
- **THEN** it writes a `last_action` breadcrumb naming that outcome itself, rather than the specify command asking the model to author the line

### Completion accounts for every loaded capability — fold it, or record a reasoned skip

A capability recorded on `livingSpecs.loaded` is a promise the run will settle it. Completion MUST close that loop for each loaded capability: either fold a requirement delta into its spec, or record an explicit skip note saying why it was left untouched. The runtime SHALL provide a skip writer (`--living-spec-skip "<name>: <reason>"`) that appends `{name, reason}` to `livingSpecs.skipped`, de-duped on the name with the first reason winning. A skip MUST both name a capability and justify it — an entry with a blank reason is dropped and warned about on stderr, so an unexplained skip never counts as accountability and the capability stays unaccounted. The fold's backstop then computes, in BOTH its no-delta branch and its partial-fold branch, the loaded capabilities that are neither folded (this run or on a prior run) nor skipped, and reports that gap loudly and actionably; when every loaded capability is accounted for it says so out loud — "correctly nothing," visibly distinct from the silently-nothing gap.

#### Scenario: a loaded capability the change didn't alter
- **WHEN** completion records a reasoned skip for a loaded capability
- **THEN** the note lands on `livingSpecs.skipped` and the fold treats that capability as accounted

#### Scenario: a skip with no reason
- **WHEN** a skip note carries a name but a blank reason
- **THEN** it is not recorded, the omission is warned on stderr, and the capability stays unaccounted

#### Scenario: a loaded capability is neither folded nor skipped
- **WHEN** the fold runs with a loaded capability that has no delta block and no skip note
- **THEN** the fold names it as unaccounted and points at the two ways to close the loop
- **AND** a partial fold that authored a delta for one capability does not silence the gap for the others

#### Scenario: an already-synced spec is folded again
- **WHEN** a spec whose capabilities were folded on a prior run is re-folded, writing nothing new
- **THEN** the persisted `livingSpecs.synced` names keep those capabilities accounted and the backstop does not false-alarm

### An unmatched MODIFIED requirement is promoted to ADDED, not dropped

A requirement authored under `## MODIFIED Requirements` that matches no existing heading in the living spec is a genuinely-new requirement, not a mistake. The fold SHALL append it as if it were ADDED — resolving its heading through the delta set's renames first — and count it separately from applied modifications, rather than silently discarding it as an unmatched target. This promotion stays idempotent: a re-fold that finds the promoted requirement already present appends nothing.

#### Scenario: a MODIFIED heading matches nothing
- **WHEN** the fold applies a MODIFIED delta whose heading is absent from the living spec
- **THEN** the requirement is appended and reported as promoted, not skipped

#### Scenario: the promoted requirement is folded again
- **WHEN** the same delta set is folded a second time
- **THEN** the already-present requirement is left in place and nothing is duplicated

### Status resolution dispatches commands from the family the spec has been running

A spec's context records which workflow drives it, and every next-step command that status and resume resolution emit MUST come from that workflow's command family: the companion commands when the context records `workflow: companion`, the stock commands otherwise. Handing a run a command from the other family mid-pipeline would silently switch its capture and completion behavior, so the recorded workflow is the single signal for the choice. Contexts written before the workflow field existed carried a retired marker instead (`profile: turbo`); resolution SHALL keep honoring that marker as meaning the companion workflow, so older specs resume on the flow they started rather than being demoted to the stock family.

#### Scenario: a companion spec resumes
- **WHEN** resolution computes the next command for a context recording the companion workflow
- **THEN** the command is drawn from the companion family

#### Scenario: an older context carries only the retired marker
- **WHEN** a context predating the workflow field records the retired companion marker
- **THEN** resolution still selects the companion family

#### Scenario: no workflow is recorded
- **WHEN** a context names neither the workflow nor the retired marker
- **THEN** resolution emits the stock command family

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

### A capability relocation is transactional — a partial failure rolls back every applied move

Relocating capabilities moves files and then rewrites the registry. When any move or the registry write fails partway, every move already applied MUST be rolled back so files and registry never disagree. The rollback accounting is owned by the caller and each entry is recorded **before** its move is attempted, so the set to undo exists even when a move raises before the batch finishes — and covers the move that was in flight, whose destination directories were already created.

#### Scenario: a later move in the batch fails
- **WHEN** the third of three moves raises an error
- **THEN** the first two moves are undone and the tree and registry are as they were before the run

#### Scenario: the registry write fails after the moves
- **WHEN** every move succeeds but the config write raises
- **THEN** all moves are rolled back and the original registry content is restored

### A reader of a captured list MUST accept every form its writer stores

Capture writes decisions, verifications, and concerns as entries carrying an identity value plus supporting detail, while hand-authored and pre-coercion contexts carry bare strings for the same fields. Any reader of one of these lists SHALL accept both forms — a non-empty string reads as itself, an entry reads through its identity value, and its supporting detail stays reachable rather than being discarded at the boundary. A reader that recognizes only one form silently drops everything real runs record while continuing to pass on hand-authored fixtures, so its emptiness reads as a fact about the run rather than a defect in the reader. An entry with no usable identity value SHALL be skipped on its own, never taking the rest of the list with it. Widening such a reader MUST NOT change the shape of what it emits — only which entries reach it — because the machine-readable resolution other commands parse is part of that shape. Lists whose writer stores plain strings only are exempt: their readers are correct by construction, and a widened branch there would be unreachable.

#### Scenario: a real run's decisions are read back
- **WHEN** status resolves a spec whose decisions were recorded by the pipeline
- **THEN** every decision appears, in the order it was recorded
- **AND** hand-authored string decisions in the same list appear unchanged alongside them

#### Scenario: one entry in the list is unusable
- **WHEN** a captured list carries an entry with no identity value among well-formed ones
- **THEN** that entry is skipped and the remaining entries are still read
- **AND** the command still exits successfully

### A configuration the reader cannot fully read is rejected whole, never applied in part

Every configuration this runtime reads is either understood completely or not used at all. A reader that meets syntax outside the subset it supports, or that stops before the end of the file for any reason, MUST report the file as malformed and fall back to the shipped defaults — it MUST NOT return the portion it happened to understand. A partially applied configuration is worse than none, because the author reads their own file and believes all of it is live while some of it silently is not. The report SHALL name the line at fault, and, per the never-fail contract, SHALL reach the caller as a warning rather than an exception.

#### Scenario: the file uses syntax the reader does not support
- **WHEN** a configuration reaches for a YAML feature outside the supported subset
- **THEN** one warning reports the file as malformed and names the line
- **AND** the shipped defaults are used, with nothing from the file applied

#### Scenario: the reader stops before the last line
- **WHEN** parsing ends with part of the file unread, whatever the cause
- **THEN** the file is reported as malformed rather than returning what was understood so far
