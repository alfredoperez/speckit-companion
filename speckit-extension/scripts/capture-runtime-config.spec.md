# Capture runtime config — Living Spec

> [DRAFT] Re-adopted on 2026-09-07 from the single capture-runtime living spec, requirements moved verbatim, every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

The configuration is a file people read and a panel edits, and the panel draws a board from what the builder resolves. Reading it, writing one key back, repairing it, and emitting its structure all have to agree with the build, so what is drawn is what would run.

## Requirements

### Writing one key back into the configuration preserves everything else byte for byte

Writing a value back into `companion.yml` SHALL be a surgical text edit — replace or insert the lines for that one key — and SHALL NOT round-trip the file through a YAML emitter. The configuration is a file people read and review, and re-emitting it reformats the comments, blank lines, and quoting somebody chose on purpose.

#### Scenario: the panel writes a command's node order
- **WHEN** the file is written back
- **THEN** every line outside that key is unchanged, comments and spacing included

#### Scenario: a key is written back off again
- **WHEN** an empty value is written for a key the file carries
- **THEN** that key's line is removed and everything around it is left byte for byte, because a selection you can make and cannot unmake is a trap rather than a choice

### A configuration too broken to read is repairable from the panel that reads it

Because the builder refuses an edit that would break the configuration, what it writes is always valid — but a file edited by hand, written by an older build, or left broken by a version with no guard yet still lands the panel on its error state. Recovery SHALL therefore be offered as the panel's own named actions rather than as "open the YAML file", which is the editing the panel exists to replace. Each repair SHALL be a small, named retreat toward what ships, they SHALL be ordered narrowest first, and each SHALL state what it will cost, because a recovery that silently discards an afternoon's work is worse than the broken pipeline.

#### Scenario: a phase is left empty by dragging its last node out
- **WHEN** repairs are offered
- **THEN** dropping that empty phase is offered first, and every other edit is kept

### The pipeline's structure is emitted here and drawn elsewhere

The structure the builder draws — the steps, the phases, the nodes, where the hooks land, what the decision routes to, and how each differs from the shipped default — SHALL be derived here from the project's own configuration and emitted for the editor to read. Deriving it a second time on the editor side would be a second source that drifts within a release, and what is drawn would stop being what a build would produce.

#### Scenario: the builder renders a project's pipeline
- **WHEN** the structure is resolved
- **THEN** it reflects the project's configuration, not the shipped defaults with the project's changes imagined on top

### A bypassed configuration is resolved and drawn, and never allowed to fail the board

A run of the shipped pipeline selects no configuration, so a project's own file is bypassed rather than emptied. The emitted structure SHALL still resolve that bypassed file and carry its hooks at the anchors they would attach to, marked as not running and excluded from every count of what this project changed — a board that draws nothing for a configured project is indistinguishable from one that was never configured. Resolving it SHALL never fail the board on any error, not only on a refusal: a file that parses but is the wrong shape raises an ordinary error, and the project most likely to hold one is the project that chose the shipped pipeline because its own configuration was broken. The same is required of the whole emission — a crash that is not a refusal SHALL still reach the panel as a readable error carrying the ways out, and the message SHALL name the file and describe the shape rather than passing on a language runtime's own sentence, which nobody can act on. What is parked SHALL NOT be counted here at all: the surface that draws the board counts what it drew, and a second number from a second source is how a header comes to say one thing while the tally beside it says another. This side reports only what the board cannot know — a hook whose anchor the shipped shape does not have, so there is nowhere to draw it, and any warning the bypassed resolve raised, which SHALL be carried rather than discarded since a running configuration surfaces its warnings and a parked one must not silently eat them.

#### Scenario: the bypassed file is the wrong shape
- **WHEN** the structure is resolved
- **THEN** the board is emitted with nothing parked, rather than failing and leaving the panel with no way to repair anything

#### Scenario: a bypassed hook attaches to something the shipped shape lacks
- **WHEN** the structure is emitted
- **THEN** it is reported as having nowhere to go, and no count of what was drawn is emitted here at all

#### Scenario: the bypassed resolve raises a warning
- **WHEN** the structure is emitted
- **THEN** the warning is carried, because a hook that resolved to nothing lands in no count and would otherwise be lost in silence

#### Scenario: the configuration crashes the emission rather than refusing
- **WHEN** the panel asks for the structure
- **THEN** it receives a readable error naming the file and the shape, together with the repairs, rather than a language runtime's own sentence and no way out

### A configuration the reader cannot fully read is rejected whole, never applied in part

Every configuration this runtime reads is either understood completely or not used at all. A reader that meets syntax outside the subset it supports, or that stops before the end of the file for any reason, MUST report the file as malformed and fall back to the shipped defaults — it MUST NOT return the portion it happened to understand. A partially applied configuration is worse than none, because the author reads their own file and believes all of it is live while some of it silently is not. The report SHALL name the line at fault, and, per the never-fail contract, SHALL reach the caller as a warning rather than an exception.

#### Scenario: the file uses syntax the reader does not support
- **WHEN** a configuration reaches for a YAML feature outside the supported subset
- **THEN** one warning reports the file as malformed and names the line
- **AND** the shipped defaults are used, with nothing from the file applied

#### Scenario: the reader stops before the last line
- **WHEN** parsing ends with part of the file unread, whatever the cause
- **THEN** the file is reported as malformed rather than returning what was understood so far

### What a project could attach is emitted with the pipeline it draws
<!-- touches: speckit-extension/scripts/build-pipeline.py, speckit-extension/scripts/pipeline-graph.py -->

The structure a panel draws SHALL carry, beside it, every hook command the project's own registries hold — the spec-kit extensions it registered and Companion's own — each with the description its registry gave it, the extension that declared it, and the lifecycle step it attaches at. A list compiled in here instead would lie about what a project has installed, and the lie would surface only when the pipeline ran. It travels with the structure rather than answering a second request, for the same reason the structure itself is derived once: a second source disagrees with the first, and the disagreement reads as one of them being out of date. A command SHALL be carried once however many steps register it, and SHALL name a usual placement only when the registries place it at exactly one — a stock install registers the automatic commit at nine, and naming the first one read presents a single truth out of nine as the answer. Reading a registry SHALL never fail the emission: one that cannot be read contributes nothing.

#### Scenario: an extension is installed
- **WHEN** the structure is emitted
- **THEN** that extension's hook commands are carried, in its own words, and a project without it is offered none of them

#### Scenario: a command is registered at several lifecycle steps
- **WHEN** the structure is emitted
- **THEN** it is carried once and names no usual placement, rather than naming whichever step was read first

#### Scenario: the registry cannot be read
- **WHEN** the structure is emitted
- **THEN** it carries what it could read and the panel still works

#### Scenario: one lifecycle key holds something that is not a list of hooks
- **WHEN** the structure is emitted
- **THEN** that key alone is skipped, both here and where the board reads the same registry, because guarding the whole walk instead made the result depend on where in the file the bad key sat and made the two disagree

### The registry's defaults hold for a real tree, and the layout is asked once

The living-specs registry has defaults that stand in for what a project never wrote, and a default that quietly matches nothing is worse than no default: the exempt list is read as "test and config files are not code anyone is asked to describe", so a pattern that only ever matched a file sitting at the repository root left every project's tests being reported as undescribed code. An exemption SHALL therefore be written to match at any depth. Where a project keeps its specs is likewise a decision made once, at set-up, and SHALL be recorded in the registry and read back from it — adoption that asks a second time is how a developer answers twice and gets a layout they did not choose. An unrecognised answer SHALL fall back to the central layout rather than being carried through as itself.

#### Scenario: a project with tests below the root and no exempt list of its own
- **WHEN** the defaults are applied
- **THEN** those test files are exempt, rather than the exemption reaching only the repository root

#### Scenario: a project already recorded where its specs live
- **WHEN** adoption runs again
- **THEN** it reads the recorded layout instead of asking a second time

### A hook's anchor resolves to exactly one boundary, by one shared definition

An anchor name MAY match the step's own name, a phase name, and a node id at once, so something SHALL pick one: the step's name first, then a node, then a phase. That precedence SHALL live in one place, and both the body assembly and the structure a panel draws from SHALL read it, so the place a hook is drawn is always the place it runs. A name that matches nothing SHALL keep being warned about and skipped, and a phase and a node MAY continue to share a name.

#### Scenario: a hook is attached to a name that is both a phase and a node
- **WHEN** the pipeline structure is built
- **THEN** the hook is emitted once, on the boundary the assembled body places it at

## Uncovered

- `companion_config.py` — read its contract docstring and failure table, not its YAML reader.
- The Python test suite under `speckit-extension/tests/` was not read.
