# Pipeline Steps — Living Spec

> Adopted from existing code on 2026-07-19. Requirements describe observed behavior and have not been individually verified against tests.

## Purpose

Pipeline Steps is the behaviour of the specify, plan and tasks step bodies: how a run sizes and routes itself, how a project extends a step at its node boundaries, and how each step loads and applies the living specs and rules it needs.

## Requirements

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

### A step's branch points are declared as data beside its node order

Where a step's node makes a routing decision, that decision SHALL be declared alongside the step's node order: which node decides, the verdicts it can reach, the steps each verdict folds away, and the notice each verdict prints. Stated only as prose — in the routing part, the workflow file, and the classifier's own instructions — the routing was changeable in none of them and drawable from none of them.

#### Scenario: a step declares its routing
- **WHEN** the pipeline is built or drawn
- **THEN** both read the same declaration rather than re-reading the prose

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

### A project's authored guidance reaches the step it was written for

The specify and plan steps SHALL read their own step's rules from the registry, off the resolver call each already makes, and treat each line as guidance for how to write that step's artifact. Neither step SHALL see the other's rules, and a registry with no rules SHALL produce behaviour identical to one written before rules existed.

#### Scenario: a project authors rules for both steps
- **WHEN** a specify run loads living specs
- **THEN** it holds the spec rules and does not hold the plan rules

#### Scenario: the rules cannot be read
- **WHEN** the rules block will not parse
- **THEN** the step runs unchanged and says once that the rules were skipped
