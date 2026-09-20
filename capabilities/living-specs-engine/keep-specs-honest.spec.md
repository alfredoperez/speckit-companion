# Keep specs honest — Living Spec

## Purpose

A living spec is only worth reading if it still matches the code and is shaped the way every reader assumes. These commands tell a person where code moved and the spec did not, fold direct edits back in one pass, check the shape of what is written, and show which requirements have a test. All of them are signals: they report and never block a run.

## Requirements

### The checks report and never block
<!-- touches: apps/speckit-extension/scripts/drift.py, apps/speckit-extension/scripts/living_validate.py, apps/speckit-extension/scripts/check-coverage.py, apps/speckit-extension/commands/speckit.companion.living-*.md -->

`/speckit.companion.living-drift`, `living-validate` and `living-coverage` SHALL be read-only and exit successfully whatever they find, with `--json` giving the same data for tooling. A surrounding workflow may treat findings as a gate, and the commands themselves never do. When `python3` is missing, the command warns and skips without failing its host.

#### Scenario: drift finds unfolded changes in CI
- **WHEN** `living-drift --json` runs and three files have drifted
- **THEN** the object lists them and the exit code is 0

### Drift lists the code that changed since the spec was last committed
<!-- touches: apps/speckit-extension/scripts/drift.py, apps/speckit-extension/commands/speckit.companion.living-drift.md -->

For each capability, drift SHALL list the files it owns that changed since its spec was last committed, marking each `tracked` when a pipeline run recorded the change but never folded it, or `unspeced` when it changed outside the pipeline. A file is not drift when it matches the registry's `exempt` globs (default `*.config.*`, `*.test.*`, `**/migrations/**`), when a run since the baseline folded into or recorded a skip for that capability, when only another capability's requirement names it, or when it is any registered capability's spec document and not code, since capabilities kept beside their code share a directory and writing one spec would otherwise drift its neighbours. `--working` also counts uncommitted edits, deletions and untracked files.

#### Scenario: a hand edit outside the pipeline
- **WHEN** a file under `src/billing/` is committed after `billing`'s spec and no feature run recorded it
- **THEN** `billing` reports the file as `unspeced`

#### Scenario: uncommitted work
- **WHEN** a file is edited and not committed
- **THEN** it is drift with `--working` and invisible without it

### Drift never reads a check it did not run as clean
<!-- touches: apps/speckit-extension/scripts/drift.py -->

A capability whose spec is not committed yet, whose baseline is cut off by a shallow clone, or whose history cannot be read SHALL be skipped with that reason rather than compared against a guess. The run ends on counts of checked and skipped, the all-in-sync line appears only when every capability was checked and clean, and the JSON carries a `checked` count. A shallow-clone skip tells the user to fetch full history.

#### Scenario: adoption day
- **WHEN** no capability's spec has been committed
- **THEN** the report reads `0 checked, 2 skipped (spec.md not yet committed)` and exits successfully

### Drift can be scoped to a branch
<!-- touches: apps/speckit-extension/scripts/drift.py -->

With `--since <ref>`, drift SHALL measure from the merge base with that ref instead of each spec's own last commit. A capability whose spec was edited on the branch counts as folded and reports no drift.

#### Scenario: a branch that changed code and its spec
- **WHEN** a branch edits files under `checkout` and also edits `checkout`'s spec
- **THEN** `living-drift --since main` reports `checkout` in sync

### A spec that is still true can be accepted
<!-- touches: apps/speckit-extension/scripts/drift.py -->

`--accept <capability>` SHALL write a `<!-- reviewed: <commit> -->` line under the spec's title, replacing an earlier one, and tell the user to commit the spec, since the commit is what moves the drift baseline. Nothing writes this line on its own.

#### Scenario: a capability flagged for code that did not change its behaviour
- **WHEN** the user runs drift with `--accept billing` and commits the spec
- **THEN** the next drift run measures `billing` from that commit

### Sync folds the current changes into every affected spec
<!-- touches: apps/speckit-extension/commands/speckit.companion.living-sync.md, apps/speckit-extension/scripts/drift.py -->

`/speckit.companion.living-sync` SHALL take its plan from the same computation as `living-drift --working` and update the spec of every capability with drifted files, one at a time, so one failure never blocks the rest. It updates rather than regenerates: what the change does not invalidate stays word for word, a requirement the code no longer has is deleted, and a revised requirement's file marker is widened to include the files that caused the revision. Capabilities with no committed spec are reported as work for `living-adopt`, and the edits are left uncommitted.

#### Scenario: a deleted file
- **WHEN** a file that a requirement describes has been deleted from the working tree
- **THEN** the sync removes that requirement instead of describing the file as if it existed

### Validate checks the shape every reader assumes
<!-- touches: apps/speckit-extension/scripts/living_validate.py, apps/speckit-extension/commands/speckit.companion.living-validate.md -->

`/speckit.companion.living-validate` SHALL check every registered living spec, or one named with `--capability`, and the delta sections of every feature spec that is not completed. Every finding SHALL carry a severity, a stable code, the file, the line, what is wrong and a one-line fix. Only three findings are errors, because only they damage the record or stop a fold: a scenario missing its WHEN or THEN, two requirements sharing a heading, and a delta marked for an unregistered capability. Everything else is a warning, so a spec worth improving is never a spec that cannot be folded. Files that could not be read are listed as skipped, so a clean report is never a verdict on them.

#### Scenario: two requirements share a heading
- **WHEN** a living spec has two `###` requirements with the same text
- **THEN** validate reports `duplicate-requirement` as an error with the file and line

#### Scenario: a removal that was recorded on purpose
- **WHEN** a REMOVED entry names a heading already recorded as removed for that capability
- **THEN** no `delta-heading-not-found` warning is raised for it

### Coverage shows which requirements have a test
<!-- touches: apps/speckit-extension/scripts/check-coverage.py, apps/speckit-extension/commands/speckit.companion.living-coverage.md -->

`/speckit.companion.living-coverage` SHALL report, per requirement, whether the capability's `.coverage.md` names it on a line that also names a test. A requirement is identified by its `FR-`/`NFR-` id when it has one and by its heading text otherwise. A capability with no coverage file reports every requirement uncovered, never an error.

#### Scenario: a capability with only a spec file
- **WHEN** coverage runs for a capability that has no `.coverage.md`
- **THEN** every requirement is listed as uncovered and the command exits successfully
