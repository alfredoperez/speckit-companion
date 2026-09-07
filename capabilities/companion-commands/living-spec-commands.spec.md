# Living Spec Commands — Living Spec

> Adopted from existing code on 2026-07-19. Requirements describe observed behavior and have not been individually verified against tests.

## Purpose

Living Spec Commands is the opt-in, never-halting family that adopts, moves, syncs, checks and reads living specs, and the file markers those commands maintain so nobody keeps them by hand.

## Requirements

### Living-spec commands are opt-in, non-halting, and honest about what they did not examine

The commands that adopt, move, report drift on, and report coverage for living specs SHALL act only when the project has opted in, SHALL never fail the run, and — for the reporting pair — SHALL make no edits. Their output MUST state both what was examined and what was skipped with a reason, so a clean marker can never be read as a verdict on the whole configuration. A finding is a signal a surrounding workflow may act on; these commands do not gate.

#### Scenario: the project has not opted in
- **WHEN** one of these commands runs
- **THEN** it reports nothing and exits successfully

#### Scenario: part of the configured set could not be examined
- **WHEN** the report is rendered
- **THEN** it names both counts and the reason for the skip

### One command syncs every affected living spec from the current changes, uncommitted included

The living-spec family SHALL include a sync command that, in a single pass, groups the working tree's changes — uncommitted edits, deletions, and untracked files, plus commits since each capability spec's baseline — by capability using the same derivation as the drift report's working-tree mode, and updates every affected capability spec in place. Updates are update-not-regenerate: content the change does not invalidate survives verbatim. The run ends with a synced/skipped report, never commits the spec edits, never redrafts a never-committed spec (that belongs to adoption), and inherits the family's opt-in, never-halt contract.

#### Scenario: changes span several capabilities
- **WHEN** the sync runs with working-tree changes touching multiple capability areas
- **THEN** every affected capability's spec is updated, each scoped to its own changed files, with no hand-picking

#### Scenario: nothing is configured
- **WHEN** the sync runs with living specs disabled or absent
- **THEN** it reports nothing to do and exits successfully

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

### A living spec is readable one slice at a time, from a terminal

A command SHALL print a capability's requirement headings, one named requirement with its scenarios, or the requirements whose file markers describe a given path, using the same requirement parser the load steps use. It SHALL be read-only, and every outcome — including an unregistered capability, a missing spec file, a name matching nothing, an ambiguous name, and a file nothing claims — SHALL exit successfully with the alternatives named.

#### Scenario: a reader asks for one requirement
- **WHEN** the command is given a requirement heading that exists in exactly one capability
- **THEN** that requirement's prose and scenarios are printed and no other requirement is

#### Scenario: a heading names two capabilities
- **WHEN** the requested heading exists in more than one registered capability
- **THEN** every candidate is listed with its capability and none is chosen

#### Scenario: living specs are off
- **WHEN** the command runs in a project with no registry, or one that is disabled
- **THEN** it reports nothing and exits successfully
