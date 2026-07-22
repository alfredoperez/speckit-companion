# Specs — Living Spec

> Adopted from existing code on 2026-07-19. Requirements describe observed behavior and have not been individually verified against tests.

## Purpose

This capability owns a spec's whole life: creating it, listing it, showing where it is in the pipeline, and — most importantly — recording what actually happened to it in a durable per-spec state file. Without it the extension would have to guess a spec's progress from which files happen to exist on disk, which is exactly the guessing that produced the repo's worst class of bug: two parts of the UI confidently disagreeing about the same spec.

## Requirements

### A spec's lifecycle state is recorded, never inferred from files

Each spec directory SHALL carry one state record holding the workflow it runs, the step it is on, its canonical status, and an ordered log of lifecycle events. Step completion MUST NOT be inferred from the presence of a document on disk: an AI can write `plan.md` and never finish planning, and a finished step can leave no new file at all. Where a document's own content matters (a stub vs. a real document), it refines what a *document row* renders, never what the *workflow* believes.

#### Scenario: a spec has a plan document but no recorded plan step
- **WHEN** the sidebar or viewer asks whether planning is done
- **THEN** the answer comes from the recorded log, not from the file listing
- **AND** the spec continues to read as still planning

#### Scenario: a spec has no state record at all
- **WHEN** the extension first encounters it
- **THEN** it backfills only facts it can verify — the workflow, the name, the branch — and starts the spec at the beginning
- **AND** it never fabricates completed steps to make the record look further along

### The lifecycle log is append-only and every write is atomic

The event log SHALL only grow. A write that would shorten it, or that would alter any entry already in it, MUST be rejected outright rather than silently accepted. Every write MUST land whole — a reader that opens the file mid-write must see either the old record or the new one, never a partial one. This is what lets a hook, a watcher, and a user action all write to the same record without one of them destroying another's history.

#### Scenario: a caller submits a rewritten history
- **WHEN** the proposed record's log disagrees with an entry already on disk
- **THEN** the write is refused with an explicit append-only error
- **AND** the on-disk record is unchanged

#### Scenario: the file exists but cannot be read or parsed
- **WHEN** a write is attempted
- **THEN** the writer refuses rather than treating the unreadable file as absent
- **AND** the caller is told why, so a transient read failure can never be mistaken for a first write

### One fact has exactly one derivation

Every derived quantity — a step's start and end, whether a step is complete, what a document row shows, what a spec's effective status is — SHALL be computed in one place and read by every consumer. Two consumers that each compute the same fact WILL eventually disagree, and this repo has shipped that bug (a row's icon and its own tooltip contradicting each other). Adding a second surface that needs a derived fact means reading the existing resolved value, not re-deriving it.

#### Scenario: the sidebar and the viewer both show a step's state
- **WHEN** each renders a step
- **THEN** both read the same derived value from the same derivation
- **AND** it is not possible for them to show contradictory states

#### Scenario: a new consumer needs "is this step complete?"
- **WHEN** it is written
- **THEN** it calls the shared query rather than re-reading the log itself

### Status moves forward and never regresses out of a terminal state

Status transitions SHALL be forward-only. A re-run, a double-fired hook, or a late-arriving write for an earlier step MUST record its event honestly in the log while leaving status and current step alone if the spec has already moved past that step. A spec that has reached a terminal state MUST NOT be dragged backwards by any subsequent write.

The furthest a step can carry a spec on its own is "implementation finished". The final closed state is written only by an explicit terminal step that ran and decided; no recovery, repair, or reconciliation path may infer it from what it finds on disk. When a recorded status is unreadable, such a path SHALL restore the highest state a step can reach on its own and leave the closing act to the terminal step. This is what lets the Companion pipeline finish a spec by itself — it does so *through* its terminal step, not by inference.

#### Scenario: a repair path meets an unreadable status
- **WHEN** it reconstructs the spec's state
- **THEN** it settles no higher than "implementation finished"
- **AND** it never writes the final closed state on its own

#### Scenario: an earlier step's completion arrives late
- **WHEN** a plan-step completion is written for a spec already at tasks
- **THEN** the completion is appended to the log
- **AND** the spec's status and current step stay where they were

### Reaching the pipeline's end is a real end state, not a bug

The Companion pipeline finishes by marking the spec complete at its last step — that is the intended behavior and the whole point of the pipeline, and MUST NOT be treated as an error to undo. Separately, the extension's *own* autonomous finish (a watcher or hook observing that the work is done) SHALL stop at "implementation finished" and leave the final closing act to the sanctioned completion path. The distinction is who decided: a pipeline that ran to its terminal step decided; a watcher that merely noticed the tasks are all checked did not.

#### Scenario: a Companion run reaches its terminal step
- **WHEN** the pipeline's last step executes
- **THEN** the spec is recorded as complete
- **AND** nothing later reverts it

#### Scenario: a watcher sees every task checked
- **WHEN** it settles the spec
- **THEN** it records the implementation as finished
- **AND** it does not itself declare the spec closed

### The implementation step settles from a signal that fires in every mode

The implementation step is the one step with no successor to close it, and the host gets no completion callback from any dispatch surface. Its settle MUST therefore hang off the one always-on, mode-agnostic signal — the task list's own file changing — rather than off a terminal handle or a workflow hook that only some modes have. The settle SHALL be guarded so it fires exactly once and only when warranted.

#### Scenario: implementation runs through a chat surface with no terminal
- **WHEN** the last task is checked off
- **THEN** the step still settles
- **AND** the spec does not sit stranded mid-implementation forever

#### Scenario: a spec parked before implementation has a fully-checked task list
- **WHEN** the watcher fires
- **THEN** nothing settles, because implementation was never underway
- **AND** the spec keeps its parked position

#### Scenario: the task list is re-saved after the step already closed
- **WHEN** the watcher fires again
- **THEN** no second closing event is recorded

### Recording state never blocks the user's work

Every lifecycle write SHALL be best-effort with respect to the user's action: a failure is logged where a maintainer can find it and then swallowed, so a dispatch, a click, or a tree refresh is never aborted because the record could not be updated. Losing one entry costs fidelity; failing the action costs the user their work.

#### Scenario: the state file is locked by another process during a dispatch
- **WHEN** the step-start write fails
- **THEN** the failure is logged
- **AND** the command still dispatches

### A corrupt state record is preserved and replaced, never overwritten

Because the writer refuses to overwrite an unparseable record, recovery MUST move the broken bytes aside to a non-colliding backup before writing a fresh minimal record in its place. The user keeps the original for manual salvage and gets a working spec back in one action.

#### Scenario: the record is truncated to invalid JSON
- **WHEN** recovery runs
- **THEN** the broken file is renamed to a timestamped backup beside it
- **AND** a fresh minimal record takes its place
- **AND** a second recovery in the same second does not clobber the first backup

### Commands that need the companion piece are gated by family, not by list

Any command belonging to the Companion namespace SHALL be recognized by its shared prefix rather than by an enumerated set, so a newly added member can never slip past the gate. When the companion piece is absent, such a command MUST either downgrade to its stock equivalent or — if it has none — be suppressed entirely with a non-blocking explanation. It MUST NEVER be dispatched in a form the AI cannot resolve.

#### Scenario: a Companion step runs without the companion piece installed
- **WHEN** the step has a stock equivalent
- **THEN** the stock command runs instead
- **AND** the user is warned without being blocked, and offered the install

#### Scenario: a Companion-only action runs without the companion piece
- **WHEN** it has no stock equivalent
- **THEN** nothing is dispatched at all
- **AND** the user is told why

### Reading a record is tolerant; writing one is strict

The reader SHALL accept records written by older versions, by other tools, and by an AI that got a field's shape slightly wrong — normalizing legacy field names, superseded status vocabulary, and loosely-typed values into the canonical shape in memory. Unknown top-level fields MUST survive a read/write round-trip, because another writer may own them. A genuinely absent record and a record that could not be read MUST be distinguishable to the caller, so a transient read failure is never mistaken for "no record here."

#### Scenario: a record uses a retired field name for its log
- **WHEN** it is read
- **THEN** it presents in the canonical shape
- **AND** the next write migrates it on disk without losing entries

#### Scenario: a field the extension does not know about is present
- **WHEN** the extension updates the record
- **THEN** that field is still there afterwards

### The specs tree presents recorded state, and its view controls are per-workspace and idempotent

The tree SHALL group specs by their recorded status, and offer filtering and ordering over that set. View state (the active filter, the chosen order, expansion) persists per workspace. Any command whose *name* asserts an end state MUST enforce that state unconditionally rather than toggling — a command called "collapse all" must never expand.

#### Scenario: a spec finishes while the tree is open
- **WHEN** its record changes on disk
- **THEN** a debounced refresh moves it to the matching group

#### Scenario: "collapse all" is invoked on an already-collapsed tree
- **WHEN** the command runs
- **THEN** the tree stays collapsed

### A workflow that records nothing still shows progress

Workflows the user defines themselves run commands that write documents but never touch the state record, which would strand them at their first step forever. For those workflows only, progression SHALL be reconstructed from the one signal they do leave — their step outputs on disk — and only ever *forward* of what the record already says. Workflows that do record their own progress MUST be left entirely alone.

#### Scenario: a user's workflow has produced its third step's output
- **WHEN** the record still says step one
- **THEN** a reconstructed progression advances it to the third step so the forward action appears
- **AND** the built-in pipelines are untouched by this path

#### Scenario: the record is already at or ahead of what disk shows
- **WHEN** reconstruction runs
- **THEN** the real record wins and nothing is rewritten

### Destructive and bulk spec actions confirm, skip no-ops, and stay inside the workspace

Deleting a spec or changing many specs' status at once SHALL confirm first, then apply only to targets the action would actually change. Any path that turns a stored or user-supplied relative path into a file operation MUST resolve it against the workspace root and confirm the target exists before acting, surfacing a visible error rather than failing silently.

#### Scenario: archiving a group where some specs are already archived
- **WHEN** the bulk action runs
- **THEN** only the not-yet-archived specs are touched
- **AND** the reported count reflects what actually changed

#### Scenario: revealing a spec folder that has been deleted outside the editor
- **WHEN** the reveal action runs
- **THEN** the user gets an explicit "does not exist" error instead of a silent no-op

### Living-spec listings are read-only, bounded, and honest about what they could not compute

The living-specs listing SHALL read the project's capability configuration without executing any project tooling, resolving each capability's document path and confining every resolved path to the workspace. [inferred] — how the listing is *presented* as tree rows is taken from the model and command surfaces; the view provider itself was not read. Derived health — coverage counts, drift — MUST be reported as *absent* when it cannot be computed, never as zero or false: a missing count and a genuine zero mean opposite things to a reader. Any external call it makes to compute health MUST be time-bounded.

#### Scenario: a capability's document has never been committed
- **WHEN** drift is computed
- **THEN** drift is reported as unknown rather than as "no drift"

#### Scenario: a configured document path points outside the workspace
- **WHEN** the listing resolves it
- **THEN** the entry is dropped rather than read

## Uncovered

- `specExplorerProvider.ts` — read in part (public surface, grouping, filtering, and the status/context-value derivation). The middle of the file, covering per-item tree construction, icons, and related-document display naming, was skimmed rather than read line by line.
- `specCommands.ts` — read in part (registration surface, lifecycle/bulk commands, phase dispatch, custom-command runner). The trailing helper section was not read line by line.
- `livingSpecsExplorerProvider.ts` — not read; its contract is inferred here from `livingSpecsModel.ts` and `livingSpecsCommands.ts`.
- All files under `__tests__/` were listed but not read.

### The Living Specs view offers a one-pass sync action

The Living Specs view's title bar SHALL carry a sync action that dispatches the living-spec sync command through the active AI provider, following the same dispatch path and companion-install gating as the adoption action. The action itself performs no grouping or file edits — the dispatched command owns the work.

#### Scenario: the action is triggered
- **WHEN** the user triggers the sync title action with the companion extension installed
- **THEN** the sync slash command is dispatched to the AI provider and nothing is edited by the extension itself

### Concurrent writes to a spec's state record are serialized, never lost

Two updates to the same spec's state record that arrive at the same time both land: writes to a single spec's `.spec-context.json` run one at a time, so a concurrent read-modify-write can never overwrite another writer's entry. Writes to different specs stay independent and never wait on each other, and a failed write releases the queue for the next one instead of wedging it.

#### Scenario: two updates race on the same spec
- **WHEN** a step-progress update and another write to the same spec overlap
- **THEN** both entries land in the lifecycle log and neither writer's change is lost

#### Scenario: a queued write fails
- **WHEN** a serialized write throws
- **THEN** its error reaches its caller and the next queued write for that spec still runs
