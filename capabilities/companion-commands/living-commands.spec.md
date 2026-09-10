# Living-Spec Commands — Living Spec

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


### Adoption proposes the links between capabilities, because only it can see them

A requirement's `aligns` marker names a rule under another capability that constrains this behaviour, and nobody writes those by hand: at the moment you are editing one capability you cannot see what governs it from elsewhere. Adoption reads a whole area in one pass and SHALL propose these where the code shows the constraint — a guard, a check, a redirect that a rule elsewhere explains — bringing each to the developer with both headings side by side before writing. The marker is matched by heading text, so a proposal MUST name a heading that exists: a mistyped one is a dead link that reads as a working edge and sends every future run to load nothing.

#### Scenario: a behaviour is guarded by a rule under another capability
- **WHEN** adoption drafts the requirement
- **THEN** it proposes the edge, naming the other capability and the exact heading, for the developer to confirm

#### Scenario: nothing in the code shows the constraint
- **WHEN** adoption drafts the requirement
- **THEN** it proposes no edge, because an invented one costs every later run a wasted read

### A capability's membership must reach the files its own requirements name

A capability's match globs are what the resolver uses to claim a file, so a capability whose globs never reach the code its requirements describe resolves to nothing: a change in that area is told about no capability at all, and the run proceeds as if nothing had been written down. Adoption SHALL therefore name the code a behaviour is implemented in rather than the surface it was found through — a capability discovered through a page usually lives elsewhere — and validation SHALL report a capability whose every requirement names files outside its own membership. Both halves are individually valid in that case, the requirement's files exist and the capability's glob matches files too, which is why nothing else catches it.

#### Scenario: adoption names the page instead of the implementation
- **WHEN** the specs are validated
- **THEN** the capability is reported, naming a requirement's files and the membership that excludes them

#### Scenario: the membership is broader than the requirement
- **WHEN** a capability claims a parent directory of the files its requirements name
- **THEN** nothing is reported, because the resolver reaches them

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

## Uncovered

_None — re-adopted from `capabilities/companion-commands/companion-commands.spec.md`; every requirement was moved verbatim from that spec, not re-read from the code._
