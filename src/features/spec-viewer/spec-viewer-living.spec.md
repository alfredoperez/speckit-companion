# Spec Viewer Living — Living Spec

<!-- reviewed: 763a4a8b -->

## Purpose

What the extension does for a panel showing a capability rather than a run: resolving its tiers, computing its health facts (coverage, drift, new requirements, test counts), and opening its links and run-log chips.

## Requirements

### A living spec is presented as a capability, not a run

A living-spec panel SHALL show the capability's requirement cards with no run state, no Overview, no rail and no workflow forward action. Its tiers open from the tree.

#### Scenario: a capability is opened from the tree
- **WHEN** the panel renders
- **THEN** it shows the requirement cards, with no Overview and no rail

### A rules file with the retired suffix still opens as the rules tier

A capability whose rules file still carries the old `.arch.md` suffix SHALL list it as its rules tier, not report the tier missing.

#### Scenario: the project predates the rules tier's rename
- **WHEN** the capability's rules file is `<stem>.arch.md`
- **THEN** it is listed as the rules tier

### Sync from the footer updates the spec on screen

The footer's Sync SHALL resolve the capability's spec tier from the open panel and run the same living-specs update command the sidebar uses.

#### Scenario: the reader syncs a drifted living spec
- **WHEN** the reader presses Sync on any tier of the capability
- **THEN** the update runs against that capability's spec tier

### A covers glob reveals its place in the Explorer

Activating a covers glob SHALL reveal the glob's static prefix in the Explorer, confined to the workspace. A prefix that is not a real path SHALL open a find-in-files scoped to the glob instead.

#### Scenario: the glob's prefix is a real folder
- **WHEN** the reader clicks the glob
- **THEN** the Explorer reveals that folder

#### Scenario: the glob has no real static prefix
- **WHEN** the reader clicks it
- **THEN** find-in-files opens with the glob as its include pattern

### A living-spec chip opens its capability in the living viewer

Clicking a run's living-spec chip SHALL open that capability in living mode. A chip without a stored path SHALL be resolved by capability name, a path outside the workspace SHALL never be opened, and a capability that cannot be found SHALL raise a warning naming it.

#### Scenario: a chip carries a path inside the workspace
- **WHEN** the reader clicks it
- **THEN** the capability opens in the living-spec viewer

#### Scenario: no spec file matches the capability's name
- **WHEN** the reader clicks its chip
- **THEN** a warning says the living spec was not found

### Best-effort facts are omitted, never rendered as zeros

Any fact the viewer cannot determine (a count, date, coverage ratio or drift verdict) SHALL be omitted, not shown as empty or zero.

#### Scenario: a capability's health cannot be computed
- **WHEN** the repository has no version control, or the check times out
- **THEN** the coverage and drift facts are absent from the header and nothing renders as `0`

### Slow facts never delay the panel's first render

Coverage, drift and new-requirement facts SHALL be resolved after the panel first renders and pushed when ready.

#### Scenario: the health check is slow
- **WHEN** a capability opens
- **THEN** its cards render before the coverage and drift facts arrive

### A late fact for a capability no longer on screen is discarded

A pushed fact SHALL be dropped when the panel has since switched to a different capability.

#### Scenario: the reader switches capability mid-check
- **WHEN** the first capability's health result arrives after the second is on screen
- **THEN** the header shows only the second capability's facts

### An open living spec redraws when its file changes on disk

An open living-spec panel SHALL redraw when its spec file is changed or created on disk, wherever the capability lives.

#### Scenario: adoption writes the spec an empty panel was showing
- **WHEN** the file appears on disk
- **THEN** the open panel redraws with its cards

### Drift is named per requirement by its touches marker

A requirement SHALL be named as drifted when its `touches` marker matches a drifted file, using the same drift result as the sidebar. A requirement with no marker never drifts, and when drift cannot be computed no requirement is named.

#### Scenario: a drifted file matches one requirement's marker
- **WHEN** health resolves
- **THEN** only that requirement is named as drifted

### Requirements added on the branch are marked new without writing the spec

The extension SHALL name as new the requirement headings the working copy has and `main`'s copy lacks. A body-only change SHALL NOT count as new, and when `main`'s copy cannot be read no requirement is named new. The spec file SHALL never be written.

#### Scenario: a branch added one requirement
- **WHEN** health resolves
- **THEN** only that heading is named new

#### Scenario: the repository has no `main`
- **WHEN** health resolves
- **THEN** no requirement is named new

### Each requirement card says how many of its tests exist

Each requirement whose coverage line names tests SHALL get a label counting them, saying how many exist when some do not. A requirement that names no test SHALL have no label, never a zero, and labels SHALL NOT carry over to another capability's cards.

#### Scenario: a requirement names two tests and one exists
- **WHEN** the capability's health resolves
- **THEN** that card's label says one of the two tests was found

#### Scenario: another capability opens and resolves no health facts
- **WHEN** its cards render
- **THEN** none of them carries the previous capability's label

## Uncovered

_None: every file in the area was read, though test files under `__tests__/` were read only for the contracts they pin._
