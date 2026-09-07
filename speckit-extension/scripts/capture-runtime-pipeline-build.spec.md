# Pipeline Build — Living Spec

> Adopted from existing code on 2026-07-19. Requirements describe observed behavior and have not been individually verified against tests.

## Purpose

Building the command bodies the assistant reads from a project's configuration: all-or-nothing assembly, hooks at node boundaries, the derived manifest, templates by section, and the packaging closure each product must ship.

## Requirements

### The configuration is the source of truth and the command bodies are built from it

A project's `companion.yml` SHALL be turned into the command bodies the assistant reads by an explicit build. Resolving a project's node order and hooks without anything rendering them is the failure this closes: a project could declare a different order or attach a hook, and get the shipped pipeline anyway, with nothing about the run looking wrong. A build SHALL resolve each command's node order, check that every kept node's inputs are still produced, resolve its hooks, assemble the bodies with node boundaries, splice the hooks in at those boundaries, write the bodies and the manifest, and state what changed. It SHALL read the extension's own sources without editing them.

#### Scenario: a project reorders a command's nodes and builds
- **WHEN** the build runs
- **THEN** the command body the assistant reads carries the project's order

### A build is all-or-nothing

Nothing SHALL be written until every command has assembled. A build that cannot complete SHALL leave the previous pipeline exactly as it was, because a half-written pipeline is a run that fails somewhere in the middle with no way to tell which half is which.

#### Scenario: one command fails to assemble
- **WHEN** the build stops
- **THEN** no command body on disk has changed

### A built body reaches the assistant only once it is carried out to the agent's own copy

A build writes the extension's copy of a command body, and nothing dispatches that copy — the assistant loads the emission the installer wrote into that agent's own directory. The build SHALL therefore carry each body out to those copies, or the build is real and reaches nothing: a project could reorder its nodes, build, be told five commands were built, and watch the assistant keep running the pipeline as it was installed. Because an agent's emission differs from the body only in its frontmatter, the carry SHALL replace the body beneath a header it leaves untouched, and SHALL rewrite a file only when that file's current body carries the node markers an assembled body has — a pointer file with no body at all would be corrupted by splicing one in.

#### Scenario: a build finishes
- **WHEN** the emissions are synced
- **THEN** each agent's own copy carries the new body under its unchanged frontmatter
- **AND** a pointer file with no body is left alone

### A hook is rendered at the node boundary it names

Hooks SHALL be rendered into the assembled body at the node boundary markers, so attaching one is an insertion at a known point rather than a guess about surrounding prose. Four kinds SHALL be supported: a shell line to run, an instruction to follow, another node's body spliced in whole, and the name of a skill the project already has. A skill hook SHALL name the skill rather than copy its text, because copying forks instructions the project already wrote.

#### Scenario: a project attaches a hook after a node
- **WHEN** the command body is assembled
- **THEN** the hook's text appears at that node's boundary, in the order the configuration declares

### A build states what each run must produce, derived from the order it assembled

Each author node already declares the document it writes; a build SHALL derive a manifest of those declarations from the same node order it assembled, never from a hand-kept list. Without it a build cannot say what it is about to produce, and a step that quietly stopped writing its document looks exactly like one that wrote it.

#### Scenario: the node order changes
- **WHEN** the build runs
- **THEN** the manifest describes the pipeline that was assembled, not a different one

### The pipeline's decision points are data, not prose in three places

The one branch in the pipeline — the classifier's verdict deciding whether a change keeps the full path or folds toward implement — SHALL be declared as data naming which node decides, the verdicts it can reach, and what each verdict does: which steps it folds away, and the notice it prints. A project SHALL be able to override where a verdict routes, and the build SHALL state the routing it resolved and note in the body when the project changed it. Written as prose in the routing part, the workflow file and the classifier's instructions, the routing was expressible in none of them and changeable in none of them.

#### Scenario: a project changes where a verdict routes
- **WHEN** the build resolves the routing
- **THEN** it applies the project's route and says in the body that the project changed it

### A template is customized by section, and the stock copy is never edited

A step SHALL relate to its template in one of three ways: produce the document from the template as it is, replace one named section of it, or write something the template does not describe. A section SHALL be addressed by its heading, because a template is already a sequence of headings and both people and models navigate it that way — so a template a project edited by hand keeps working and there is no new marker syntax. Stock templates SHALL NOT be edited in place: the build writes a resolved copy into the project's built output, so an upgrade that changes a stock template does not silently discard what the project asked for.

#### Scenario: a project replaces one section of the spec template
- **WHEN** the build resolves templates
- **THEN** a resolved copy carries the replacement and the stock template on disk is unchanged

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

- `capture-golden.py`, `assemble-nodes.py`, `build-commands.py`, `check-shape-parity.py`, `_command_parts.py` — build-time tooling, covered by the companion-commands spec rather than here.
