# Run Reports — Drift

## Purpose

Drift is code a capability claims that changed without anyone saying what it changed about the behaviour. This capability defines what counts as drift and how to ask about it early, before it becomes a backlog.

## Requirements

### The drift detector offers an opt-in working-tree mode

The drift script SHALL accept a working-tree mode that widens each capability's changed set to the baseline→worktree diff plus untracked files, de-duplicated, and widens the tracked-vs-unspeced scan the same way. The default invocation runs the same git commands and renders identical human output, and the machine-readable result names its mode. The never-fails exit contract and the checked/skipped counts hold in both modes.

#### Scenario: an uncommitted edit in a capability's area
- **WHEN** drift runs without the flag and then with it
- **THEN** the default run reads the capability as in sync and the working-tree run reports the file as drifted

### A file a run already accounted for is not drift

The detector SHALL drop from a capability's drifted set every file changed by a run that folded a delta into that capability or recorded a reasoned skip for it, read from the runs' own records. A file changed by hand, with no run behind it, is still drift. Accounting is per capability: a run that settled one capability vouches for nothing in another.

#### Scenario: a completed run folded into this capability
- **WHEN** drift runs afterwards
- **THEN** the files that run changed are not reported, but a later hand edit is

#### Scenario: a run recorded a reasoned skip
- **WHEN** drift runs afterwards
- **THEN** that run's files are not reported either, because a skip says the spec still holds

### A living spec is not code that drifts, whoever wrote it

Every registered capability's spec documents SHALL be excluded from every capability's drift, not only its own. Colocated capabilities often claim the directory holding a sibling's spec, so writing one spec would otherwise drift its neighbours.

#### Scenario: two colocated capabilities share a directory
- **WHEN** one of their specs is written
- **THEN** the other reports no drift from it

### Drift can be asked about one branch, so it is answerable before it is a backlog

The report SHALL also measure from the merge base with a named ref, answering which capabilities this branch touched and whether it folded them. A capability whose spec was written on the same branch reports nothing. Work already on the base SHALL NOT be reported.

#### Scenario: a branch changes code a capability claims and writes no spec
- **WHEN** drift is measured from the branch point
- **THEN** that capability is named

#### Scenario: the same branch also writes that spec
- **WHEN** drift is measured from the branch point
- **THEN** nothing is named, because the change was accounted for

#### Scenario: an unfolded change was already on the base
- **WHEN** drift is measured from the branch point
- **THEN** nothing is named, because this branch did not make it

### A file one requirement names does not drift the capabilities that only share its folder

When a requirement's marker in one capability names a changed file, the drift report SHALL attribute that change to that capability alone. A sibling capability whose glob matches the file but whose requirements never name it SHALL NOT be reported as drifted. A changed file no requirement names still drifts every capability that claims it.

#### Scenario: two capabilities claim one folder and a requirement names the changed file
- **WHEN** drift is computed
- **THEN** only the capability with that requirement is reported

#### Scenario: a changed file no marker names
- **WHEN** drift is computed
- **THEN** every capability whose glob matches it is reported
