# Capture runtime living resolve — Living Spec

> [DRAFT] Re-adopted on 2026-09-07 from the single capture-runtime living spec, requirements moved verbatim, every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

The resolver is the single reading of the living-specs registry: which capability owns a file, which requirements a change should read, and where each spec lives. Every other tool calls it instead of re-reading the registry, so boundaries and markers are honoured the same way everywhere.

## Requirements

### Living-spec path resolution stops at a nested project boundary

A directory with its own companion config is a separate project, and discovery SHALL stop there without reporting, claiming, or promoting anything inside it. Resolution is the single source of these rules: the sync, fold, drift, and coverage tools call it instead of re-interpreting the configuration.

#### Scenario: a sample project is nested in the tree
- **WHEN** discovery walks into a directory holding its own companion config
- **THEN** the walk stops and nothing inside is reported as the parent's

### Recording which living specs cover a change MUST be deterministic, not AI-judged

The capture runtime SHALL provide a script that takes a feature directory and changed files, gates on the registry's `enabled: true`, runs the shipped resolver, and records the owning capabilities (most-specific first) on `livingSpecs.loaded`. The specify command bodies call this script instead of asking the model to decide. It is best-effort, opt-in, and read-only: any miss is a silent no-op that exits successfully. The recorder returns its outcome (`loaded`, `no-match`, or `not-configured`) and writes the `last_action` breadcrumb from it, so "correctly did nothing" is never misread as "not configured".

#### Scenario: an enabled registry with a matching change
- **WHEN** the recorder runs with changed files a configured capability owns
- **THEN** `livingSpecs.loaded` lists the matched capabilities most-specific first
- **AND** the recording never fails or slows the command

#### Scenario: the feature is off or nothing matches
- **WHEN** the registry is absent or disabled, or no capability owns the changed files
- **THEN** the recorder writes nothing and exits successfully

#### Scenario: the recorder writes its own audit breadcrumb
- **WHEN** the recorder finishes, whether it matched, found no match, or found the feature not configured
- **THEN** it writes a `last_action` breadcrumb naming that outcome itself, instead of the model authoring the line

### A living-spec load is sliced by requirement, and a spec with no markers is read whole

For each matched capability, the resolver SHALL report either that its spec is read whole (when it carries no file marker) or its purpose plus the requirements whose marker matches a changed file and every unmarked requirement. Each reported requirement SHALL carry its own prose and scenarios, the purpose arrives whole, and fenced examples are never stripped from either. A report SHALL distinguish "nothing was checked" from "nothing was wrong": an unreadable registry or a run started below the repository root MUST NOT render as a clean result. A capability whose markers all miss still appears with its purpose and no requirements, so completion accounting sees it. A marker can only narrow: every load contributes unmarked requirements.

#### Scenario: a marked capability and a change it claims
- **WHEN** a load resolves a capability whose requirements carry markers
- **THEN** it reports the purpose plus the matching and unmarked requirements, not the whole file
- **AND** each requirement arrives with its own text, so the step needs no second read

#### Scenario: a purpose or a requirement containing a fenced example
- **WHEN** the load payload is built
- **THEN** the example is still there, because a reader cannot tell that anything is missing

#### Scenario: a report runs where it cannot find the registry
- **WHEN** it renders
- **THEN** it says nothing was checked and why, instead of reporting a clean result

#### Scenario: a capability with no markers
- **WHEN** a load resolves it
- **THEN** it is reported as read whole, byte-identical to the behaviour before markers existed

A marker is the first non-blank line under its heading, not necessarily the next line, and several markers MAY sit there in any order. This survives a formatter inserting a blank line after the heading. Every marker in that run SHALL be kept out of the prose a reader is handed.

#### Scenario: a formatter puts a blank line under the heading
- **WHEN** a load slices that requirement
- **THEN** the marker is still read, and no marker reaches the reader as prose

A requirement SHALL be able to name a constraining rule under another capability by capability and heading, since no file match reaches it. A caller SHALL be able to ask a load to follow those names: each named requirement is added to its capability's entry, the entry is created if needed, and it is marked as reached by the edge. The walk SHALL be one hop and never follow the targets' own edges. Following SHALL be opt-in, so a load's size stays predictable.

#### Scenario: a matched requirement names a rule under a capability the change did not touch
- **WHEN** a load is asked to follow the edges
- **THEN** that capability appears carrying only the named requirement, marked as reached by the edge

#### Scenario: the named requirement names an edge of its own
- **WHEN** the same load runs
- **THEN** the second edge is not followed

#### Scenario: the load is not asked to follow
- **WHEN** it runs
- **THEN** it contributes exactly what the file match resolved, and nothing else

### Which requirements a run read is recorded beside which capabilities it loaded

The capture runtime SHALL record the requirement headings a run read, per capability, in a sibling of the loaded-capability list, leaving that plain list of names unchanged for its existing readers. A capability read whole gets no entry. The write is additive and idempotent, and a failure to record MUST NEVER fail the host command.

#### Scenario: a capability read by requirement
- **WHEN** the recorder runs
- **THEN** the sibling record names the requirements read, and the capability list keeps its plain-list shape

#### Scenario: a capability read whole
- **WHEN** the recorder runs
- **THEN** the capability is listed as loaded and the sibling record has no entry for it

#### Scenario: the recorder runs while the editor is writing the same record
- **WHEN** it takes its several read-modify-write turns
- **THEN** each one queues on the shared write lock like any other writer

#### Scenario: a capability consulted whose markers all missed
- **WHEN** the recorder runs
- **THEN** it records that capability with an empty requirement list, because "consulted and contributed nothing" differs from "read whole"

### Colocating a capability with no folder of its own leaves it central

A relocation to colocated SHALL keep a capability central, and say why, when it has no folder of its own. That covers globs spanning sibling directories and an area other capabilities live inside, matching what adoption already does.

#### Scenario: a capability whose globs cover sibling directories is moved to colocated
- **WHEN** the relocation resolves the target
- **THEN** the spec stays central and the reason is reported

#### Scenario: another capability lives inside this one's area
- **WHEN** the relocation resolves the target
- **THEN** it is treated as the layer's capability and stays central

### The registry carries per-step guidance, normalized to one shape

The registry reader SHALL normalize an optional `rules` block to a list per known pipeline step, always present and empty when unset. An unknown step key or unusable value is dropped with a warning, never raised. `rules` SHALL be a registry-owned key, so re-emitting the registry preserves it.

#### Scenario: a capability is added to a registry that carries rules
- **WHEN** the registry is rewritten to record the new capability
- **THEN** the authored rules are still in the file afterwards

#### Scenario: a step key nobody recognizes
- **WHEN** the block names a step that takes no rules
- **THEN** that key is dropped with a warning and every other step's rules are unaffected

### The resolver answers for one capability, one requirement, or one file

The resolver SHALL return a capability's headings, one requirement in full, or the requirements matching a file, using the same slicing as the load steps, so its counts match the coverage denominator and the viewer's outline. A requirement with no marker SHALL be returned for every file its capability claims.

#### Scenario: a capability is registered but its spec file is gone
- **WHEN** the resolver is asked for that capability's headings
- **THEN** it reports that there is no spec on disk, never a spec with zero requirements

### A capability relocation is transactional — a partial failure rolls back every applied move

When any move or the registry write fails partway through a relocation, every applied move MUST be rolled back so files and registry never disagree. The caller owns the rollback list and records each entry **before** attempting its move, so the in-flight move is undone too.

#### Scenario: a later move in the batch fails
- **WHEN** the third of three moves raises an error
- **THEN** the first two moves are undone and the tree and registry are as they were before the run

#### Scenario: the registry write fails after the moves
- **WHEN** every move succeeds but the config write raises
- **THEN** all moves are rolled back and the original registry content is restored

## Uncovered

- `relocate-capability.py`: read only its opening docstring.
- `register-capability.py`: read only its contract docstring.
- The Python test suite under `speckit-extension/tests/` was not read.

### The resolver answers what leans on a requirement

`resolve-spec-paths.py --leaned-on-by <capability>#<heading>` SHALL return every requirement, in any capability including the target's own, whose aligns marker names that heading exactly, each with its capability, heading, touches and body. No match and a disabled registry SHALL both give an empty `matches` list. Without `--json` it SHALL print one `capability#heading` per line.

#### Scenario: two capabilities align to one heading
- **WHEN** a command asks who leans on it
- **THEN** both requirements are returned

#### Scenario: nothing aligns to the heading
- **WHEN** a command asks who leans on it
- **THEN** `matches` is empty
