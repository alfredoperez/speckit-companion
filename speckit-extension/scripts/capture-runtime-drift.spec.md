# Run Reports — Drift

## Purpose

Drift is the code a capability claims that changed without anyone saying what it changed about the behaviour. This capability covers what counts as drift, what does not, and how the question can be asked early enough to answer rather than only in aggregate once it has become a backlog.

## Requirements

### The drift detector offers an opt-in working-tree mode

The drift script SHALL accept a working-tree mode that widens each capability's changed set from committed history to the baseline→worktree diff plus untracked files, de-duplicated, with the tracked-vs-unspeced scan widened the same way. The default invocation issues exactly the pre-existing git commands and renders identical human output; the machine-readable result names which mode produced it. The never-fails exit contract and the checked/skipped counts semantics hold in both modes.

#### Scenario: an uncommitted edit in a capability's area
- **WHEN** drift runs without the flag and then with it
- **THEN** the default run reads the capability as in sync and the working-tree run reports the file as drifted

### A file a run already accounted for is not drift

Drift is code that changed with nobody saying whether the spec still describes it, and a run that folded a delta into a capability, or recorded a reasoned skip for it, has said exactly that. The detector SHALL therefore drop from a capability's drifted set every file changed by such a run, read from the runs' own records rather than from anything the report keeps for itself. Reporting them anyway tells a developer to review work they finished on the run that changed the file, which is how a drift report becomes a list people scroll past. A file changed by hand, with no run behind it, is drift as before, and the accounting is per capability: a run that settled one capability vouches for nothing in another.

#### Scenario: a completed run folded into this capability
- **WHEN** drift runs afterwards
- **THEN** the files that run changed are not reported, while a hand edit since is

#### Scenario: a run recorded a reasoned skip
- **WHEN** drift runs afterwards
- **THEN** that run's files are not reported either, because a skip is the run saying the spec still holds

### A living spec is not code that drifts, whoever wrote it

A capability's own spec documents are already excluded from its drift. That is not enough where capabilities sit beside the code they describe: one capability's membership routinely claims the directory its siblings keep their specs in, so writing one spec reports every neighbour as having drifted code. Any registered capability's spec documents SHALL therefore be excluded from every capability's drift, not only from its own.

#### Scenario: two colocated capabilities share a directory
- **WHEN** one of their specs is written
- **THEN** the other reports no drift from it

### Drift can be asked about one branch, so it is answerable before it is a backlog

Measured across the whole repository, drift is only ever read once it has become a backlog, and by then it is on nearly every capability and means nothing. The report SHALL therefore also measure from the merge base with a named ref, so it answers a question about the work in hand: which capabilities did this branch touch, and did it fold any of them. A capability whose spec was written on the same branch reports nothing, because that is the loop closing rather than drift. Work that was already on the base is not this branch's to answer for, and reporting it is how a branch-scoped check becomes noise like the whole-repo one.

#### Scenario: a branch changes code a capability claims and writes no spec
- **WHEN** drift is measured from the branch point
- **THEN** that capability is named

#### Scenario: the same branch also writes that spec
- **WHEN** drift is measured from the branch point
- **THEN** nothing is named, because the change was accounted for

#### Scenario: an unfolded change was already on the base
- **WHEN** drift is measured from the branch point
- **THEN** nothing is named, because this branch did not make it
