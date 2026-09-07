# Living Spec Fold — Living Spec

> Adopted from existing code on 2026-07-19. Requirements describe observed behavior and have not been individually verified against tests.

## Purpose

Folding a feature spec's requirement deltas back into the durable living specs: idempotent verbs, per-capability routing, completion accounting, shape validation, and the guards that refuse to damage a spec.

## Requirements

### Folding a feature spec's requirement deltas into a living spec is idempotent for every verb combination

At completion, a feature spec's requirement deltas become part of the durable living spec. Re-applying the same delta set to its own output MUST be a byte-for-byte no-op — for a single verb, for any ordered pair, and for any combination. Verbs SHALL apply in a fixed pipeline order regardless of the order they appear in the document, and an addition MUST resolve its heading through the delta set's own renames before deciding whether that section already exists. A rename chain that loops back on itself names no destination and its entries are dropped as unsatisfiable rather than applied.

#### Scenario: a delta set both adds and renames the same heading
- **WHEN** the set is folded a second time
- **THEN** the living spec is unchanged and no section is duplicated

#### Scenario: the same heading is both added and modified
- **WHEN** the fold resolves the conflict
- **THEN** the modified body wins over the added body

### The fold routes each capability's requirements to its own spec

A feature spec may declare a delta block per capability, each marked `<!-- capability: <name> -->`. The fold applies to each capability only the requirement units marked for it, plus unmarked units when that capability is the changed-files-matched default. A requirement marked for one capability never lands in another capability's spec.

#### Scenario: two blocks marked for different capabilities

- **WHEN** a completing feature's spec carries an `ADDED` block marked for capability A and another marked for capability B
- **THEN** A's spec receives A's requirement only, B's spec receives B's requirement only, and both names are recorded on `livingSpecs.synced`

#### Scenario: an unmarked block on a multi-capability fold

- **WHEN** a block carries no capability marker
- **THEN** it folds into the capability the changed files resolved to, and not into any marker-routed capability

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

### A living spec's shape is checkable, and the fold refuses to write a break
<!-- touches: speckit-extension/scripts/living_validate.py, speckit-extension/scripts/living_spec_fold.py -->

The capture runtime SHALL provide a read-only check over every registered living spec and over the delta sections of active feature specs, reporting a requirement carrying no scenario, a scenario missing its condition or its outcome, two requirements sharing a heading inside one capability, a delta block marked for a capability the registry does not list, a delta entry naming a heading the target spec does not carry, and a file marker matching nothing on disk. Each finding SHALL carry a severity, a stable code, the path, the line, a sentence and a one-line fix, and the check SHALL always exit successfully — a report that can fail the shell it runs in is a gate wearing a report's clothes. Severity SHALL answer exactly one question, whether the fold stops, so error means the durable record would be damaged and warning means it would be untidy. The fold SHALL run the same check in-process before writing anything and refuse, per capability, on an error-level finding, naming it; a correctness gate that a missing interpreter or a subprocess failing for its own reasons can turn into "no findings" is not a gate. A refusal for one capability SHALL NOT prevent another's sound delta from being applied in the same run.

#### Scenario: a delta would fold in a scenario nobody can check
- **WHEN** the fold runs
- **THEN** that capability is refused, the finding is named, and its spec is left byte for byte unchanged

#### Scenario: a delta names a heading the target does not carry
- **WHEN** the fold runs
- **THEN** it applies, because the fold promotes an unmatched modification into an addition and that is a defined outcome rather than damage, and the finding is reported as a warning

#### Scenario: one capability is refused and another is sound
- **WHEN** the fold runs
- **THEN** the sound capability is written and only the broken one is refused

#### Scenario: the check itself fails
- **WHEN** it raises
- **THEN** the fold proceeds, because a broken check must never block a sound fold

#### Scenario: a block is marked for a capability nobody registered
- **WHEN** the fold runs
- **THEN** the refusal is reported naming that capability, because an unregistered name is never one of the fold's targets and a refusal filed under it would be unreachable — the block would be dropped and the author told nothing

#### Scenario: the check runs on a delta rather than on a whole spec
- **WHEN** the requirement shapes are checked
- **THEN** the file-marker check is skipped rather than run and discarded, because indexing the tree is a cost the fold pays before every write and this path never keeps the result

### A fold cannot empty a spec unless the capability declared its retirement
<!-- touches: speckit-extension/scripts/living_spec_fold.py, speckit-extension/scripts/companion_config.py, speckit-extension/scripts/resolve-spec-paths.py -->

A fold that would leave a capability's spec with no requirements at all SHALL be refused, naming the capability, unless that capability declares its retirement in the registry. A stale spec is recoverable where an emptied one has lost the thing that made it worth keeping, so emptying one is a deliberate act and has to be declared as one. The declaration SHALL be optional and its absence SHALL read as false, and it SHALL be carried through to the shape the fold actually sees rather than left behind in the registry the fold never reads.

#### Scenario: a fold would remove the last requirement and retirement is not declared
- **WHEN** the fold runs
- **THEN** it refuses, names the capability, and says how to declare the retirement

#### Scenario: the capability declared its retirement
- **WHEN** the same fold runs
- **THEN** it applies

#### Scenario: a fold removes some requirements but not all
- **WHEN** it runs
- **THEN** it applies whether or not retirement is declared

#### Scenario: the guard and the applier disagree about what a requirement is
- **WHEN** either counts
- **THEN** they count the same headings, by the same slicer every other reader uses, because a guard with its own notion refuses a fold that wrote requirements and permits one that removed them all

#### Scenario: the spec carries a fence that is never closed
- **WHEN** the guard counts
- **THEN** it refuses nothing, because everything under an unclosed fence is invisible to it and a count it cannot trust must not be grounds for a refusal

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
