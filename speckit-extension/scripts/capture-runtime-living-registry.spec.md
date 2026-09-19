# Living-Spec Registry — Living Spec

## Purpose

The registry records what each run loaded and read, and its maintenance tools add and relocate capabilities without losing authored rules or leaving files and registry out of step.

## Requirements

### The capabilities a change loads are recorded by the resolver, not judged by the model

Recording is opt-in through the registry's `enabled: true` and never fails or slows the command.

#### Scenario: an enabled registry with a matching change
- **WHEN** the recorder runs with changed files a configured capability owns
- **THEN** `livingSpecs.loaded` lists the matched capabilities most-specific first

#### Scenario: the feature is off or nothing matches
- **WHEN** the registry is absent or disabled, or no capability owns the changed files
- **THEN** the recorder writes nothing and exits successfully

### The recorder's breadcrumb names its own outcome

"Correctly did nothing" must never read as "not configured".

#### Scenario: the recorder finds no match
- **WHEN** it finishes
- **THEN** it writes a `last_action` breadcrumb saying no capability matched, not that the feature is off

### Which requirements a run read is recorded beside which capabilities it loaded

The plain list of loaded names keeps its shape for existing readers. A failure to record never fails the host command.

#### Scenario: a capability read by requirement
- **WHEN** the recorder runs
- **THEN** the sibling record names the requirements read, and the capability list keeps its plain-list shape

#### Scenario: a capability read whole
- **WHEN** the recorder runs
- **THEN** the sibling record has no entry for it

#### Scenario: a capability consulted whose markers all missed
- **WHEN** the recorder runs
- **THEN** it records that capability with an empty requirement list, because "contributed nothing" differs from "read whole"

### Colocating a capability with no folder of its own leaves it central

A capability whose globs span sibling directories, or whose area other capabilities live inside, has no folder of its own.

#### Scenario: a capability whose globs cover sibling directories is moved to colocated
- **WHEN** the relocation resolves the target
- **THEN** the spec stays central and the reason is reported

#### Scenario: another capability lives inside this one's area
- **WHEN** the relocation resolves the target
- **THEN** the spec stays central

### A relocation that fails partway rolls back every move

Files and registry never disagree, including for the move that was in flight.

#### Scenario: a later move in the batch fails
- **WHEN** the third of three moves raises an error
- **THEN** the first two moves are undone and the tree and registry are as they were before the run

#### Scenario: the registry write fails after the moves
- **WHEN** every move succeeds but the config write raises
- **THEN** all moves are rolled back and the original registry content is restored

### Authored registry rules survive a registry rewrite

#### Scenario: a capability is added to a registry that carries rules
- **WHEN** the registry is rewritten to record the new capability
- **THEN** the authored `rules` block is still in the file afterwards

### An unknown step in the registry rules is dropped with a warning

#### Scenario: a step key nobody recognizes
- **WHEN** the `rules` block names a step that takes no rules
- **THEN** that key is dropped with a warning, nothing raises, and every other step's rules are unaffected
