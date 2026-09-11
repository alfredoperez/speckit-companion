# Living-Spec Commands — Living Spec

<!-- reviewed: d589a63e -->

> [DRAFT] Surface-first draft from existing code — every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

The commands that adopt, sync, validate, show and report on living specs are opt-in, read-honest and never halt the run. Without this contract, a clean report could be read as a verdict on files it never examined, and a check could rewrite the spec it was checking.

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

### A spec that is still true can say so, and stop drifting

Drift is measured from the moment the spec was last committed, so a spec nobody needs to change drifts further every week and there is no way to record that someone read it against the code and found it correct. Left alone every capability ends up flagged, and a flag on everything is a flag on nothing. The drift report SHALL therefore take an explicit acceptance, per capability, which writes the commit it was read against into the spec itself. The record lives in the spec because committing it is what moves the baseline: kept anywhere else it would need its own bookkeeping to stay true, which is the problem it exists to solve. Nothing writes it on its own — reviewing is a claim a person makes, and a report that recorded its own review would be worth exactly as much as no report.

#### Scenario: a spec is read and found correct
- **WHEN** its capability is accepted
- **THEN** the spec carries the commit it was read against, and its requirements are untouched

#### Scenario: the report runs
- **WHEN** drift is computed
- **THEN** no acceptance is recorded, because nobody read anything

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

## Uncovered

_None — re-adopted from `capabilities/companion-commands/companion-commands.spec.md`; every requirement was moved verbatim from that spec, not re-read from the code._
