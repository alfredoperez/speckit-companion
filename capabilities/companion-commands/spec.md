# Companion Commands — Living Spec

> Adopted from existing code on 2026-07-19. Requirements describe observed behavior and have not been individually verified against tests.

## Purpose

Companion Commands is the prompt surface the extension actually ships: the seventeen commands a user or the workflow engine dispatches, the reusable node and part files those command bodies are assembled from, and the preset that carries the stock command family. It exists because the extension dispatches *text* and gets no callback — so every guarantee about pipeline shape, capture, and completion has to be written into the prompt itself. Without it, the extension has no way to make a run behave, and no way to stop the same rule from being restated in nine places and drifting.

## Requirements

### Command bodies are assembled from single-sourced parts and nodes, and the assembly is the contract

No shipped command body is hand-authored end to end. A rule that applies to more than one command SHALL live in exactly one part file, and a command's structure SHALL be expressed as an ordered list of node files, each carrying its own identity and declared reads and writes. The committed bodies stay whole and self-contained — they are what the agent reads — but they are *generated*, and a gate MUST hold each assembled region byte-identical to its source. Editing a shipped body directly is therefore a defect, not a shortcut: it forks a shared rule silently.

#### Scenario: a shared rule changes
- **WHEN** a rule embedded in several commands is edited
- **THEN** it is edited in its single part file
- **AND** every command body carrying it is reassembled

#### Scenario: a body is edited in place
- **WHEN** a shipped body's assembled region no longer matches its source
- **THEN** the parity gate fails and names the command and the region

### Assembly changes MUST be proved against a frozen baseline

Reshaping how bodies are built MUST NOT change the instructions the agent receives. Commands not intentionally changed SHALL compare equal to a frozen capture of their prior text, after normalizing the assembly markers themselves, so a refactor of the build mechanism is demonstrably behavior-preserving. Re-freezing the baseline is a deliberate, separate act after an intentional wording change — never something the build performs on its own.

#### Scenario: the assembly mechanism is refactored
- **WHEN** the bodies are rebuilt
- **THEN** each unchanged command matches its frozen capture byte-for-byte

#### Scenario: a command's wording is intentionally changed
- **WHEN** the change is deliberate
- **THEN** the baseline is re-frozen explicitly, outside the build

### The manifest is the command inventory's single authority, and every downstream surface is gated against it

The extension manifest declares what commands exist. Every surface derived from that list — the files the installer writes into each agent's directory, the registry, the documentation tables — MUST agree with it in both directions, and a gate SHALL enforce that. Both drift directions matter: a missing entry means a command the user cannot reach, and an orphaned entry means a renamed command whose retired name stays live in the agent's list because reinstallation merges names and never deletes. The gate MUST discover install areas rather than iterating a fixed list, since a hardcoded list quietly stops covering a new agent directory — the same drift one level down. An input it cannot resolve MUST fail loudly rather than shrink the surface it scans.

#### Scenario: a command is renamed
- **WHEN** the manifest names the new command
- **THEN** the gate reports the stale file left behind under the old name

#### Scenario: a new command is added
- **WHEN** the command file exists but the manifest does not declare it
- **THEN** the installer would skip it, and the gate fails

### Four commands are lifecycle hooks, never user-facing verbs

The manifest binds four commands to spec-kit's own lifecycle events. They are state-writing only: they record where a run reached and MUST NOT create spec directories, author documents, or do any of the work the surrounding command is responsible for. Users do not invoke them directly — the host pipeline fires them — so their bodies are written for a machine trigger, not for a person choosing a next action.

#### Scenario: a pipeline phase finishes
- **WHEN** the host fires the matching lifecycle event
- **THEN** the hook records the step and status and does nothing else

### The pipeline's document shape lives in command bodies, never in document templates

Shape is delivered by overriding the command bodies, not by shipping alternative document scaffolds. This is a mechanism constraint, not a preference: template overrides only resolve when a setup script invokes the resolver, and the specification command copies its template by literal path, so a template override for it would silently do nothing. Command overrides apply uniformly to every command, which makes them the only reliable single mechanism. The accepted cost is that the on-disk templates keep showing the stock shape while the Companion commands simply do not read them.

#### Scenario: a Companion-shaped document is wanted
- **WHEN** the desired shape differs from stock
- **THEN** the change is made in the command body
- **AND** no alternative document template is shipped for it

### Both command families are always present; the workflow choice only routes dispatch

The stock family and the namespaced Companion family coexist permanently. Choosing a workflow SHALL add and remove nothing — it selects which family a given spec dispatches, and that choice is recorded on the spec so every later dispatch path resolves consistently. Keeping the stock family present is enforced by an add-only reconciliation that restores it when absent and never removes it, so no configuration change can strand a project without a working command set. Where a Companion command has no counterpart, it passes through unchanged rather than being forced into a mapping.

#### Scenario: a spec was created under one workflow
- **WHEN** a later step is dispatched from any surface
- **THEN** the spec's recorded workflow decides which family's command runs

#### Scenario: the spec-kit extension is not installed
- **WHEN** a namespaced command would be dispatched
- **THEN** it downgrades to its stock counterpart with a visible warning rather than failing

#### Scenario: the stock family is missing from a checkout
- **WHEN** the extension activates
- **THEN** the stock family is restored, and nothing is ever removed

### Every command degrades rather than failing the host

The bodies instruct the agent to treat capture, hook evaluation, and living-spec work as best-effort. A missing interpreter, an absent config, a malformed file, or an unavailable capability SHALL produce a single warning and a skip, never a halt. This tone is uniform across the family precisely so that no command becomes the one that can break a user's run.

#### Scenario: a prerequisite is unavailable
- **WHEN** a command reaches a step whose prerequisite is missing
- **THEN** it warns once, skips that step, and completes its real work

### The pipeline right-sizes itself automatically, and an unresolved size runs the full pipeline

Ceremony is matched to the change without any user-facing setting. A thin classification step emits one size signal from a fixed, single-sourced guardrail, and routing picks a branch from it: a small change folds toward implementation with less ceremony, an oversized change gets a visible warning and then the *same* full pipeline, and anything else runs the full pipeline. Routing MUST never silently skip a phase, and the default branch MUST be the full pipeline so an ambiguous or unresolved size can never under-plan a change.

#### Scenario: the size signal cannot be resolved
- **WHEN** routing has no usable size
- **THEN** the full pipeline runs

#### Scenario: a change clearly exceeds the bar
- **WHEN** the size is oversized
- **THEN** a warning is shown and every phase still runs

Every size the product documents MUST be reachable and MUST behave differently from its neighbours. A size that no classification can produce, or that prescribes exactly what another size prescribes, is a distinction the product advertises and does not make — and it is worse than having one size fewer, because a reader plans around it.

The vocabulary MUST be the same everywhere. Every step that records a size, and every step that reads one, uses one set of words; a step that emits a word its readers do not understand drops the classification in silence and the full ceremony runs regardless.

#### Scenario: the largest size is chosen
- **WHEN** a change is judged well beyond the small bar
- **THEN** that size is recorded, and the resulting documents differ observably from the middle size

#### Scenario: a size is classified on its own rather than during a run
- **WHEN** the standalone classification step reports a size
- **THEN** the value it records is one every reader of the recorded size understands

### Completion is an explicit terminal step with exactly one writer

The Companion pipeline ends at a dedicated completion command; the stock pipeline has no terminal step and simply stops. That command writes the terminal status through the shared writer and never by hand, refuses a spec whose work is outstanding, and is a no-op on a spec already shipped. This is the pipeline's completion gate — a second writer of that status MUST NOT be introduced anywhere.

#### Scenario: implementation finishes
- **WHEN** the terminal step runs
- **THEN** the spec is promoted to completed through the single writer
- **AND** the recorded current step stays at the last real step

#### Scenario: work remains
- **WHEN** the terminal step runs against an unfinished spec
- **THEN** it refuses and reports, without failing the host

"The work validates" SHALL mean the project's own checks ran and passed, not that the result was read against the spec. A spec MUST NOT be marked complete over a failing suite the run introduced: the failure is fixed, or the spec is left at the implemented status with the reason stated. Where the checks genuinely could not be run, that SHALL be recorded as a concern before completing, so the record says "finished, unverified" rather than implying "finished, verified". Completing on red is how a run that looks finished ships broken code, and the completed status is the one signal a reader trusts without opening anything.

A verification entry SHALL record the command that ran and its real outcome, never a restatement of intent, and a check that could not be run SHALL produce a concern and no verification entry at all — an entry for a check that never happened is worse than no entry, because every later reader trusts it.

#### Scenario: a test the run authored fails
- **WHEN** the implement step reaches its end
- **THEN** the failure is fixed before completion, or the spec stays at implemented with the reason stated

#### Scenario: the project has no runnable test script
- **WHEN** the run cannot execute its checks
- **THEN** it says so in the summary and records a concern
- **AND** it records no verification entry for the check it did not run

### The feature pointer is written under the exact key the capture calls read

The pointer file the first step writes SHALL name the feature directory under the one key the later capture calls resolve through when they run without an explicit feature directory. Any other key is silently dropped: the writes go nowhere and the run records nothing, with no error anywhere to notice.

#### Scenario: a later step runs without an explicit feature directory
- **WHEN** it resolves the spec through the pointer file
- **THEN** it finds the directory the first step wrote

### Living-spec commands are opt-in, non-halting, and honest about what they did not examine

The commands that adopt, move, report drift on, and report coverage for living specs SHALL act only when the project has opted in, SHALL never fail the run, and — for the reporting pair — SHALL make no edits. Their output MUST state both what was examined and what was skipped with a reason, so a clean marker can never be read as a verdict on the whole configuration. A finding is a signal a surrounding workflow may act on; these commands do not gate.

#### Scenario: the project has not opted in
- **WHEN** one of these commands runs
- **THEN** it reports nothing and exits successfully

#### Scenario: part of the configured set could not be examined
- **WHEN** the report is rendered
- **THEN** it names both counts and the reason for the skip

### Projects extend commands at node boundaries, never by editing bodies

Because a body is generated, a project customizing it would be overwritten. Instead, a project SHALL declare its own work against a command's node boundaries in a configuration file, and the assembled body carries the prose that makes the agent the runtime for those declarations — running each boundary's attachments in declared order. A recipe may also override which nodes a command runs. Attachments referencing a boundary the active node set does not contain MUST warn and be skipped rather than silently doing nothing, and the whole mechanism inherits the never-fail-the-host contract.

#### Scenario: a project attaches work to a node boundary
- **WHEN** the command reaches that node
- **THEN** the project's attachments run in declared order at that boundary

#### Scenario: an attachment names a boundary that is not in the active node set
- **WHEN** the configuration is merged
- **THEN** it warns and skips rather than failing or silently ignoring

An assembled body SHALL carry an explicit marker at each node's start and end, and a coarser marker around each phase — a named group of consecutive nodes in the same order — so an attachment lands at a known point rather than being placed by guessing at surrounding prose, and so a project has somewhere coarser than a single node to attach to. A step's node order SHALL declare its phases over exactly those same node ids, in that same order, with the flat order remaining the authority on sequence.

Each node SHALL carry a human-readable name for the panel, and a step's declaration SHALL name the nodes it ships but does not run by default, along with which default node each of them stands in for — so swapping the spec draft for a delta draft or a bugfix draft is a pick rather than a rewrite. A node whose output the size budget may fold away SHALL declare that output as one it *may* write, not one it must, so a folded run is not reported as an incomplete one.

#### Scenario: a project attaches work to a phase
- **WHEN** the command reaches that phase's first node
- **THEN** the attachment runs there, without the project naming an individual node

#### Scenario: a run folds the design side files into the plan
- **WHEN** the run is checked against what it should have produced
- **THEN** the folded documents are not counted as missing

### Commands direct capable providers to parallelize, while bookkeeping stays serialized

Where a provider can spawn workers, the bodies SHALL make concurrency the expected strategy rather than an optional optimization, and SHALL express independence structurally — waves of tasks that share no files or dependencies, with explicit join points — rather than relying on the agent to infer it from inline markers. Concurrency MUST NOT extend to the shared record: prose that fans work out MUST name who serializes the write, because "journal each as it finishes" under concurrent workers reads as a race. Hosts without workers run sequentially and produce identical artifacts.

#### Scenario: a wave of independent tasks is reached
- **WHEN** the provider supports workers
- **THEN** the wave's tasks run concurrently and the next wave waits for it

#### Scenario: the provider cannot spawn workers
- **WHEN** the same wave is reached
- **THEN** it runs sequentially with no error and the same result

### A command that injects a step into a numbered body MUST NOT restart the numbering

Node bodies are concatenated, so numbering is a property of the *assembled* command, not of any one node. A node adding a step to a command whose numbering continues downstream SHALL use a sub-bullet or an unnumbered note rather than opening a fresh top-level number, and the check is made against the assembled body.

#### Scenario: a node adds a step mid-command
- **WHEN** the assembled body is reviewed
- **THEN** the step numbering runs continuously with no repeated number

### A step's branch points are declared as data beside its node order

Where a step's node makes a routing decision, that decision SHALL be declared alongside the step's node order: which node decides, the verdicts it can reach, the steps each verdict folds away, and the notice each verdict prints. Stated only as prose — in the routing part, the workflow file, and the classifier's own instructions — the routing was changeable in none of them and drawable from none of them.

#### Scenario: a step declares its routing
- **WHEN** the pipeline is built or drawn
- **THEN** both read the same declaration rather than re-reading the prose

### The command inventory records what each command's run must produce

Alongside the command list, the shipped inventory SHALL record, per command, the artifacts a run is expected to produce and which node produces each — derived from the same node order the bodies were assembled from, and marking the ones a fold may legitimately skip. Without it, a step that quietly stopped writing its document is indistinguishable from one that wrote it.

#### Scenario: a run is checked against what it claimed
- **WHEN** the expected artifacts are read
- **THEN** they describe the pipeline that was actually assembled

## Uncovered

Read in full: the extension manifest, all part files, the node order and a sample of node bodies across all four pipeline commands, the completion and resume command bodies, one hook command body, and the inventory/parity/assembly gate contracts. Not read:

- The full bodies of `speckit.companion.specify.md`, `.plan.md`, `.tasks.md`, `.implement.md`, `.auto.md`, `.living-adopt.md` (the six largest, together roughly 118 KB) — their contracts were taken from `docs/template-profiles.md`, `docs/capture-and-timing.md`, the manifest descriptions, and the node files they assemble from.
- `speckit.companion.after-plan.md`, `.after-tasks.md`, `.after-implement.md` — read one hook body in full and treated the other three as the same shape per the manifest.
- `speckit.companion.status.md`, `.classify.md`, `.living-move.md`, `.living-drift.md`, `.living-coverage.md`.
- All seven `presets/companion-standard/commands/*.md` carrier bodies and `preset.yml`.
- Most individual node bodies under `nodes/` — read the order files, frontmatter shape, and three representative bodies.
- `speckit-extension/workflows/speckit-companion.workflow.yml`.

### Completion accounts for every loaded capability — a delta or an explicit skip, never silence

The completion step (both the implement-time close and the terminal `mark-complete`) instructs the AI to read `livingSpecs.loaded` and account for **every** name in it before folding — each gets exactly one of two outcomes. A loaded capability whose *behavior* the feature changed gets a marked delta block appended to the feature spec capturing the real requirement. A loaded capability merely read for context gets an explicit recorded skip (`write-context.py --living-spec-skip "<name>: <reason>"`), so "correctly nothing" stays distinguishable from "silently nothing." A loaded capability that is neither is a hole the fold flags loudly. The delta verb is chosen by whether the requirement's heading already exists in that capability's living spec: a heading not already there goes under `## ADDED Requirements` even when it revises the same behavior area, and `## MODIFIED Requirements` is reserved for editing the body of a heading that already matches one in the living spec.

#### Scenario: a feature changed a loaded capability

- **WHEN** the feature loaded a capability and changed its behavior
- **THEN** the completion step authors a delta block marked for that capability, and the fold writes the requirement into that capability's spec

#### Scenario: a capability was read but not changed

- **WHEN** the feature loaded a capability but did not change its behavior
- **THEN** an explicit skip is recorded for it, not silence, and its spec is left untouched

#### Scenario: a loaded capability is left unaccounted

- **WHEN** a name in `livingSpecs.loaded` gets neither a delta block nor a recorded skip
- **THEN** the fold flags it loudly as a hole

### Step boundaries are extension-stamped in order on every dispatch path

Each pipeline step's start SHALL be recorded by a script call placed **above the step's extension-hooks fence**, so that hooks and every node run inside the window the step later reports; a stamp sitting partway down the body leaves that work attributed to no step at all. The instruction SHALL be single-sourced as one shared command part fenced into each step frame, never copied per command, so the four bodies cannot drift. A step that mints its own feature directory SHALL stamp the instant that directory exists and before any other work, since it has nothing to stamp against earlier. Plan/tasks completions SHALL be recorded by their after-step hook commands — both `by: extension`, start before complete. The AI SHALL self-close only clarify and analyze at step level; a step whose boundaries the extension stamps must never receive an AI step-level complete, because the idempotent completion append lets the first writer win.

#### Scenario: plan runs on any dispatcher
- **WHEN** the plan command body begins its work
- **THEN** a script-stamped extension start is recorded before any planning output
- **AND** the after-plan hook later records the extension-stamped completion

#### Scenario: a step's hook never fires
- **WHEN** the after-step hook is skipped (missing or unparseable extensions registry)
- **THEN** the next step's extension start still closes the span and the duration stays trusted

#### Scenario: the extension already seeded this step's start
- **WHEN** the command body's own stamp runs after a dispatcher already recorded the step's start
- **THEN** no second start entry is appended and the earlier timestamp stands

### Task finishes are folded into the shared record one at a time, as they land

Recording an implement task SHALL be a two-part closing action — append the finish, then fold it — executed by the MAIN agent in the foreground the moment the task's work completes. Fanned-out workers SHALL only append to the event log; the main agent folds each worker's finish as its result returns, and the wave-join and end-of-step folds are idempotent backstops, not the cadence.

#### Scenario: a wave of tasks executes
- **WHEN** each task in the wave finishes
- **THEN** the watched context file and its checkbox advance before the next task starts

#### Scenario: workers run in parallel
- **WHEN** several workers finish tasks concurrently
- **THEN** each appends only its own event-log line and the main agent alone performs every fold

### One command syncs every affected living spec from the current changes, uncommitted included

The living-spec family SHALL include a sync command that, in a single pass, groups the working tree's changes — uncommitted edits, deletions, and untracked files, plus commits since each capability spec's baseline — by capability using the same derivation as the drift report's working-tree mode, and updates every affected capability spec in place. Updates are update-not-regenerate: content the change does not invalidate survives verbatim. The run ends with a synced/skipped report, never commits the spec edits, never redrafts a never-committed spec (that belongs to adoption), and inherits the family's opt-in, never-halt contract.

#### Scenario: changes span several capabilities
- **WHEN** the sync runs with working-tree changes touching multiple capability areas
- **THEN** every affected capability's spec is updated, each scoped to its own changed files, with no hand-picking

#### Scenario: nothing is configured
- **WHEN** the sync runs with living specs disabled or absent
- **THEN** it reports nothing to do and exits successfully

### The prompting contract is held by a static gate, not by convention

The commands under the never-halts contract — the four lifecycle hooks, the living-spec reports and sync, completion, status, resume, and classify — SHALL be scanned on every change for instructions that stop to ask the user, and the clarify-type carrier SHALL be required to ask. The scan reads the command sources as text (negated mentions and fenced templates do not count), and a roster file it cannot find fails loudly rather than shrinking the surface it checks.

#### Scenario: a prompt instruction slips into a never-halts command

- **WHEN** a command on the never-halts roster gains a non-negated ask-the-user instruction
- **THEN** the quality gate fails naming the command and quoting the offending line

#### Scenario: the clarify carrier stops asking

- **WHEN** the clarify-type command body no longer contains an ask instruction
- **THEN** the quality gate fails — asking is that command's purpose

### The specify-time living-spec load is recorded deterministically, not by AI judgment

Pre-briefing at specify no longer asks the AI to decide whether the project is configured or which capabilities apply — that hand-judgment is exactly what silently skipped the load on real runs. Given the files the change will touch, a deterministic recorder script re-reads the capability registry (`living-specs.yml`, or the legacy `livingSpecs` block), gates on `enabled`, runs the resolver, and writes the matched capabilities (leaf-first) onto `livingSpecs.loaded` **plus the one-line audit breadcrumb itself** — all on `.spec-context.json`, never touching the lifecycle log. The AI then only reads `livingSpecs.loaded` back to pull those specs into context; the reading is best-effort background, the recorder is the reliable write. The recorder is a silent no-op that exits 0 when the feature is off, nothing matches, or the registry/resolver can't be read, and is skipped without failing when the interpreter is unavailable — so it never fails or slows the command.

#### Scenario: the project keeps living specs for a touched area

- **WHEN** the recorder runs with the change's in-scope files against an enabled registry that matches
- **THEN** it writes the matched capabilities leaf-first onto `livingSpecs.loaded` with the audit breadcrumb, and the AI reads those specs back from the record

#### Scenario: nothing is configured or nothing matches

- **WHEN** the recorder runs with the feature off or no capability owning the touched files
- **THEN** it is a silent no-op that exits successfully, and the breadcrumb marks "correctly did nothing" apart from a broken capture

### A simple-verdict run captures the same context a full run would, on the fast path

When the classify step returns `simple`, specify writes the plan inline as the spec's `## Approach` section and never reaches `plan` or `tasks`. To keep the viewer honest, that fast path SHALL still capture what a full run would: the one-line approach is persisted onto `.spec-context.json` so the Overview APPROACH card reads it; the living-spec load is run **again post-draft** when the pre-draft load recorded nothing (the touched files are known by then, and the record is skipped if already populated); and the folded `plan` and `tasks` boundaries are stamped `by: extension` at step level — not as AI substeps — so the timing display counts specify, plan, and tasks as measured phases. All of it is best-effort and skipped silently when the interpreter is unavailable, and no `completed` status is written — the terminal gate stays its own step.

#### Scenario: classify returns simple

- **WHEN** the specify command finishes a simple-verdict draft
- **THEN** the approach is captured, the folded plan and tasks boundaries are stamped as extension step-level events, and the spec lands at tasks with `status: ready-to-implement`

#### Scenario: the pre-draft load recorded nothing

- **WHEN** the simple run reaches the fold and `livingSpecs.loaded` is still empty
- **THEN** the deterministic recorder runs once against the now-known touched files, and never re-resolves when the load already populated it

### The tasks Polish phase validates the spec's Success Criteria in exactly one place

The tasks command's final Polish phase generates a task to validate the result against the spec's Success Criteria. The deferral is gated on an explicit marker, not the mere presence of a hook: only when a hook entry under `commands.implement.hooks.after.implement-exec` (in `.specify/companion.yml`) carries `owns: validation` does that hook own the run, so the Polish phase MUST defer to it rather than generate a second suite run. Presence of an unmarked hook does not defer — the same anchor also hosts review, PR, and deploy hooks, so keying on presence would silently drop validation for any project with a ship tail. With no marked hook the Polish phase owns validation and generates the run itself. Validation ownership therefore lives in exactly one place, and a project that owns its own run never executes the suites twice.

#### Scenario: a project marks a hook as owning validation
- **WHEN** the tasks command builds the Polish phase and a hook under `commands.implement.hooks.after.implement-exec` carries `owns: validation`
- **THEN** the Polish validation task defers to that hook and no second suite run is generated

#### Scenario: unmarked post-implement hooks are present (a ship tail)
- **WHEN** the tasks command builds the Polish phase and hooks exist under `commands.implement.hooks.after.implement-exec` but none carries `owns: validation`
- **THEN** the Polish phase generates and owns the validation run — the unmarked hooks do not defer it

#### Scenario: no post-implement hook is declared
- **WHEN** the tasks command builds the Polish phase and no such hook is present (or `companion.yml` is absent or malformed)
- **THEN** the Polish phase generates and owns the validation run, as before

### A diagnostic command recomputes reality rather than trusting what a run recorded
<!-- touches: speckit-extension/commands/speckit.companion.doctor.md -->

Where a command reports on the health of a run, it MUST derive its answer by recomputing, never by reading back a verdict the run recorded about itself — a run that claimed it was clean is precisely the case worth checking. Such a command SHALL be read-only, SHALL always exit successfully, and SHALL isolate each of its checks so that one failing becomes that check's stated skip reason rather than taking the report down. It MUST report, for every check it knows about, whether that check ran, was skipped with a reason, or did not apply, so that "found nothing" and "could not look" can never print the same way. Its core checks MUST derive from the durable record and the on-disk documents alone, so that it produces a meaningful verdict on a run that finished long before the command existed.

#### Scenario: a recorded claim contradicts the recomputation
- **WHEN** a run recorded that an area was clean and recomputing finds otherwise
- **THEN** the contradiction is reported as a false claim, showing both sides

#### Scenario: a check cannot run
- **WHEN** the input a check needs is missing
- **THEN** it is reported as skipped with the reason, never as clean

Where the build has recorded what a run of this pipeline must produce, the command SHALL also hold the run to that record and report a step that closed without a document it declared. That finding is a warning rather than a gate, because the record describes the pipeline as it is built today while the spec on disk may have been produced by an earlier one, and a step that produced none of the declared documents SHALL be read as a run of some other pipeline and reported as no record rather than as a fault.

#### Scenario: a step closed without the document its node declares
- **WHEN** the command compares what the build recorded against the spec on disk
- **THEN** the missing document is reported as a warning naming the step and the node that writes it
- **AND** a step that produced none of the declared documents is reported as no record rather than a fault

### Optional instrumentation is delivered by re-rendering the bodies, never left dormant in them

A switch that adds instruction text to command bodies MUST change which bodies get rendered, not toggle a passage inside them. With the switch off the text MUST be absent from the assembled body entirely, so an off render stays byte-identical to the frozen baseline and the parity gate keeps its meaning. The switch SHALL be declared in the project's own configuration and read through the existing loader, inheriting its failure table, and it MUST NOT introduce a second mechanism for changing command text. Because a body is a static file the agent reads, the switch necessarily affects the next dispatched command and never one already in flight.

#### Scenario: the switch is off
- **WHEN** the bodies are assembled
- **THEN** they contain no instrumentation text and match the frozen baseline byte for byte

#### Scenario: a parity gate runs while the switch is on locally
- **WHEN** the gate assembles the bodies to compare them
- **THEN** it compares the off render, so a local switch can never fail the gate

### The load steps read a living spec by requirement, and fall back to the whole file

The specify and plan load steps SHALL ask the resolver what each capability should contribute for the files the change touches, and read only what it names. What the resolver names SHALL include each requirement's own text, not only its heading: a list of headings is a table of contents the step would then have to resolve by hand, which is the reading the narrowing exists to avoid. Where the resolver is unavailable or the call fails, they SHALL read each capability's spec whole exactly as before: the narrowing is an optimization, and it must never cost a step its brief.

#### Scenario: the resolver answers
- **WHEN** a load step runs against a capability carrying markers
- **THEN** it reads that capability's purpose and the named requirements only
- **AND** each named requirement arrives with its prose and scenarios, so no second read is needed

#### Scenario: a purpose containing a fenced example
- **WHEN** the purpose is handed to the load step
- **THEN** it arrives whole, fences included — fence-stripping decides where the section ends and must never be what the reader is given

#### Scenario: the resolver is unavailable
- **WHEN** the call fails
- **THEN** the step reads the whole spec and continues, without failing the command

### Adoption and sync write the file markers, so nobody maintains them by hand

Adoption SHALL write a marker under each requirement it produces, naming the files that requirement was derived from. A sync SHALL write or widen the marker of each requirement it updates, as the union of what the marker already named and the files it folded in — never narrowing, since a requirement that keeps claiming a file it no longer touches costs a run one extra requirement, where narrowing could cost it a needed one.

#### Scenario: a capability is adopted
- **WHEN** its requirements are written
- **THEN** each carries a marker naming the files it was derived from

#### Scenario: a sync updates a requirement
- **WHEN** the update is written
- **THEN** that requirement's marker names the changed files as well as what it already named

#### Scenario: fold-back rewrites a requirement that already carries a marker
- **WHEN** the delta replaces that requirement's section
- **THEN** the marker survives the replacement, widened by anything the delta names, because the span being replaced covers the marker line and a plain replacement would silently discard what adoption wrote

### The shape check is a command, and it reports rather than gates
<!-- touches: speckit-extension/commands/speckit.companion.living-validate.md -->

The command that checks living-spec shape SHALL act only when the project has opted in, SHALL make no edits, and SHALL never fail the run. Its output MUST state both what was examined and what was skipped with a reason, so a clean report can never be read as a verdict on files that were never examined. The body SHALL NOT direct the assistant to edit a spec to satisfy a finding: fixing is the author's decision, made with the finding in front of them, and a command that quietly rewrites a spec to silence its own report is the opposite of a check.

#### Scenario: the command runs on a project with findings
- **WHEN** it reports
- **THEN** it names each finding's file, line and fix, and edits nothing

#### Scenario: living specs are off for the project
- **WHEN** the command runs
- **THEN** it says so and exits successfully

#### Scenario: the command is run from below the repository root
- **WHEN** it reports
- **THEN** it says nothing was checked and where the registry actually is, rather than the words it uses when the feature is genuinely off
