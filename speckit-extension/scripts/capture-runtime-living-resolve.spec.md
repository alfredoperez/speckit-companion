# Capture runtime living resolve — Living Spec

> [DRAFT] Re-adopted on 2026-09-07 from the single capture-runtime living spec, requirements moved verbatim, every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

The resolver is the single reading of the living-specs registry: which capability owns a file, which requirements a change should read, and where each spec lives. Every other tool calls it rather than re-interpreting the registry, so a boundary or a marker is honoured the same way everywhere.

## Requirements

### Living-spec path resolution stops at a nested project boundary

A directory carrying its own companion config is a separate project. Discovery SHALL stop there and never report, claim, or promote anything inside it — otherwise a sample or vendored project nested in the tree gets its specs attributed to the parent. Resolution is the single source of these rules; the sync, fold, drift, and coverage tools call it rather than re-interpreting the configuration themselves.

#### Scenario: a sample project is nested in the tree
- **WHEN** discovery walks into a directory holding its own companion config
- **THEN** the walk stops and nothing inside is reported as the parent's

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

### A living-spec load is sliced by requirement, and a spec with no markers is read whole

The resolver SHALL report, for each capability a change matches, either that its spec is read whole — the case when the spec carries no file marker anywhere — or the capability's purpose plus the requirements to contribute: those whose marker matches a changed file, and every requirement carrying no marker. What it reports SHALL be text a step can act on rather than references it must resolve: each requirement carries its own prose and scenarios, the purpose arrives whole, and neither is stripped of the fenced examples inside it. A report SHALL distinguish "nothing was checked" from "nothing was wrong": a registry that could not be read, and a run started from below the repository root, both examined nothing, and rendering either as a clean result is the one failure a report of this kind must never have. Removing fences is how the parser finds a heading, and it must never be what a reader is given. A capability whose markers all miss still appears, with its purpose and no requirements, because it was consulted and completion accounting must still see it. A marker can only narrow: an unmarked requirement is contributed by every load, so a missing or too-narrow marker costs a run an extra requirement rather than starving it of one.

#### Scenario: a marked capability and a change it claims
- **WHEN** a load resolves a capability whose requirements carry markers
- **THEN** it reports the purpose plus the matching and unmarked requirements, and not the whole file
- **AND** each of those requirements arrives with its own text, so the step needs no second read

#### Scenario: a purpose or a requirement containing a fenced example
- **WHEN** the load payload is built
- **THEN** the example is still there, because a reader handed prose with a hole in it cannot tell that anything is missing

#### Scenario: a report runs where it cannot find the registry
- **WHEN** it renders
- **THEN** it says nothing was checked and why, rather than reporting a clean result over files it never opened

#### Scenario: a capability with no markers
- **WHEN** a load resolves it
- **THEN** it is reported as read whole, byte-identical to the behaviour before markers existed

A marker is the first non-blank line under its heading, not the line immediately under it, and several markers MAY sit there in any order. Requiring the very next line is what a markdown formatter breaks — one puts a blank line between a heading and an HTML comment — and a spec that came back from a pre-commit hook with every requirement silently unmarked is read whole by every load afterwards, which looks like a working load and is a spec nobody is slicing. Every marker in that run of lines is parser metadata and SHALL be kept out of the prose a reader is handed, since a reader given a marker as prose cannot tell it was never part of the requirement.

#### Scenario: a formatter puts a blank line under the heading
- **WHEN** a load slices that requirement
- **THEN** the marker is still read, and none of the markers reach the reader as prose

Every other edge in a living spec points at code, so a file match finds it. A rule that constrains a requirement but lives under another capability is reachable by nothing: no file the change touched belongs to it, and the run is briefed without the constraint it is about to break. A requirement SHALL therefore be able to name such a rule by capability and heading, and a caller SHALL be able to ask a load to follow those names — adding each named requirement to its own capability's entry, creating that entry when the changed files never reached it, and marking it as arriving by the edge rather than by a file match. The walk SHALL be one hop and never the targets' own edges, so a load stays bounded and a spec cannot pull the whole registry in behind it. Following SHALL be asked for rather than assumed, because a load that silently widens is a load nobody can predict the size of.

#### Scenario: a matched requirement names a rule under a capability the change did not touch
- **WHEN** a load is asked to follow the edges
- **THEN** that capability appears in the load carrying only the named requirement, marked as reached by the edge

#### Scenario: the named requirement names an edge of its own
- **WHEN** the same load runs
- **THEN** the second edge is not followed

#### Scenario: the load is not asked to follow
- **WHEN** it runs
- **THEN** it contributes exactly what the file match resolved, and nothing else

### Which requirements a run read is recorded beside which capabilities it loaded

The capture runtime SHALL record the requirement headings a run read, per capability, as a sibling of the existing loaded-capability list rather than as a change to it — that list is a plain list of names several readers already consume, including the completion accounting that requires every loaded capability to end with a delta or a recorded skip. A capability read whole receives no entry, because naming all of its requirements would say nothing the capability record does not. The write is additive and idempotent, and a failure to record it MUST NEVER fail the host command.

#### Scenario: a capability read by requirement
- **WHEN** the recorder runs
- **THEN** the sibling record names the requirements read, and the capability list keeps its plain-list shape

#### Scenario: a capability read whole
- **WHEN** the recorder runs
- **THEN** the capability is listed as loaded and the sibling record carries no entry for it

#### Scenario: the recorder runs while the editor is writing the same record
- **WHEN** it takes its several read-modify-write turns
- **THEN** each queues on the shared write lock like any other writer, because a script that mutates the record and does not take the lock is the lost write the lock exists to prevent, whichever script it is

#### Scenario: a capability consulted whose markers all missed
- **WHEN** the recorder runs
- **THEN** it records that capability with an empty requirement list, because "consulted and contributed nothing" and "read whole" are different facts and only the second is the absent entry

### Colocating a capability with no folder of its own leaves it central

A colocated spec sits in the folder its capability's code lives in, which assumes there is such a folder. Two shapes have none: a capability whose globs span sibling directories, where the common parent belongs to all of them, and a capability over a whole area that other capabilities live inside, where the folder is the layer's rather than this one's. Adoption already sends both central, so a relocation SHALL make the same judgement rather than undo it — keeping the capability central, and saying why, instead of dropping its spec into a folder full of other capabilities' code.

#### Scenario: a capability whose globs cover sibling directories is moved to colocated
- **WHEN** the relocation resolves the target
- **THEN** the spec stays central and the reason is reported

#### Scenario: another capability lives inside this one's area
- **WHEN** the relocation resolves the target
- **THEN** it is treated as the layer's capability and stays central

### The registry carries per-step guidance, normalized to one shape

The registry reader SHALL normalize an optional `rules` block to a list per known pipeline step, always present and empty when unset, dropping an unknown step key or an unusable value with a warning rather than raising. `rules` SHALL be a key the registry owns, so re-emitting the registry preserves it.

#### Scenario: a capability is added to a registry that carries rules
- **WHEN** the registry is rewritten to record the new capability
- **THEN** the authored rules are still in the file afterwards

#### Scenario: a step key nobody recognizes
- **WHEN** the block names a step that takes no rules
- **THEN** that key is dropped with a warning and every other step's rules are unaffected

### The resolver answers for one capability, one requirement, or one file

The resolver SHALL expose the slice a caller asks for — a capability's headings, one requirement in full, or the requirements matching a file — from the same slicing that serves the load steps, so the count it reports equals the coverage denominator and the viewer's outline. A requirement carrying no marker SHALL be returned for every file its capability claims.

#### Scenario: a capability is registered but its spec file is gone
- **WHEN** the resolver is asked for that capability's headings
- **THEN** it reports that there is no spec on disk, never a spec with zero requirements

### A capability relocation is transactional — a partial failure rolls back every applied move

Relocating capabilities moves files and then rewrites the registry. When any move or the registry write fails partway, every move already applied MUST be rolled back so files and registry never disagree. The rollback accounting is owned by the caller and each entry is recorded **before** its move is attempted, so the set to undo exists even when a move raises before the batch finishes — and covers the move that was in flight, whose destination directories were already created.

#### Scenario: a later move in the batch fails
- **WHEN** the third of three moves raises an error
- **THEN** the first two moves are undone and the tree and registry are as they were before the run

#### Scenario: the registry write fails after the moves
- **WHEN** every move succeeds but the config write raises
- **THEN** all moves are rolled back and the original registry content is restored

## Uncovered

- `relocate-capability.py` — read only its opening docstring.
- `register-capability.py` — read only its contract docstring.
- The Python test suite under `speckit-extension/tests/` was not read.
