# Capture runtime build — Living Spec

<!-- reviewed: a9c0b02b -->

> [DRAFT] Re-adopted on 2026-09-07 from the single capture-runtime living spec, requirements moved verbatim, every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

The build renders a project's `companion.yml` into the command bodies the assistant reads. It must be all-or-nothing, reach every agent's copy, and ship every module each product needs.

## Requirements

### Each product ships every module its own entry points reach

Each product's file list MUST carry the modules its own entry points need, and the two lists need not match. A module a runtime script imports MUST appear on the list of every product that ships that script. Modules SHALL be imported by plain name, not loaded dynamically, so the packing gate can derive the shipping closure by following imports.

Attempting a capability deliberately left out of a build MUST report clearly that it is unavailable here. A missing module SHALL NOT become a silent no-op that reports success.

#### Scenario: a script gains a new import
- **WHEN** a runtime script starts importing a new sibling
- **THEN** every product that ships that script lists the new module before release

#### Scenario: a build omits a capability on purpose
- **WHEN** something asks that build to perform it
- **THEN** it fails loudly, explaining the capability is unavailable here
- **AND** it does not quietly do nothing and report success

#### Scenario: a module is loaded by file path instead of imported
- **WHEN** the archive gate derives the shipping closure
- **THEN** the dynamically loaded module is not discovered and the archive is incomplete

### The configuration is the source of truth and the command bodies are built from it

An explicit build SHALL turn `companion.yml` into the command bodies the assistant reads, so a declared order or hook actually changes the run. The build SHALL resolve each command's node order, check every kept node's inputs are still produced, resolve hooks, assemble bodies with node boundaries, splice hooks in at those boundaries, write the bodies and manifest, and state what changed. It SHALL read the extension's own sources without editing them.

#### Scenario: a project reorders a command's nodes and builds
- **WHEN** the build runs
- **THEN** the command body the assistant reads carries the project's order

### A build is all-or-nothing

Nothing SHALL be written until every command has assembled. A build that cannot complete SHALL leave the previous pipeline exactly as it was.

#### Scenario: one command fails to assemble
- **WHEN** the build stops
- **THEN** no command body on disk has changed

### A built body reaches the assistant only once it is carried out to the agent's own copy

The build SHALL carry each body out to the emissions the installer wrote into each agent's directory, because the assistant loads those, not the extension's copy. The carry SHALL replace the body beneath an untouched frontmatter header. It SHALL rewrite a file only when its current body carries the node markers of an assembled body, so a pointer file with no body is not corrupted.

#### Scenario: a build finishes
- **WHEN** the emissions are synced
- **THEN** each agent's copy carries the new body under its unchanged frontmatter
- **AND** a pointer file with no body is left alone

### A hook is rendered at the node boundary it names

Hooks SHALL be rendered into the assembled body at the node boundary markers. Four kinds SHALL be supported: a shell line to run, an instruction to follow, another node's body spliced in whole, and the name of an existing project skill. A skill hook SHALL name the skill rather than copy its text.

#### Scenario: a project attaches a hook after a node
- **WHEN** the command body is assembled
- **THEN** the hook's text appears at that node's boundary, in the order the configuration declares

### A build states what each run must produce, derived from the order it assembled

A build SHALL derive a manifest of each author node's declared document from the same node order it assembled, never from a hand-kept list.

#### Scenario: the node order changes
- **WHEN** the build runs
- **THEN** the manifest describes the pipeline that was assembled, not a different one

### The pipeline's decision points are data, not prose in three places

The classifier's branch SHALL be declared as data: the deciding node, its possible verdicts, and what each does (which steps it folds away and the notice it prints). A project SHALL be able to override where a verdict routes. The build SHALL state the routing it resolved and note in the body when the project changed it.

#### Scenario: a project changes where a verdict routes
- **WHEN** the build resolves the routing
- **THEN** it applies the project's route and says in the body that the project changed it

### A template is customized by section, and the stock copy is never edited

A step SHALL relate to its template in one of three ways: use it as is, replace one named section, or write something it does not describe. A section SHALL be addressed by its heading, so hand-edited templates keep working with no new marker syntax. Stock templates SHALL NOT be edited in place; the build writes a resolved copy into the project's built output.

#### Scenario: a project replaces one section of the spec template
- **WHEN** the build resolves templates
- **THEN** a resolved copy carries the replacement and the stock template on disk is unchanged

## Uncovered

- `capture-golden.py`, `assemble-nodes.py`, `build-commands.py`, `check-shape-parity.py`, `_command_parts.py`: build-time tooling, covered by the companion-commands spec rather than here.
- The Python test suite under `speckit-extension/tests/` was not read.
