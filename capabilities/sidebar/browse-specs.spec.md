# Browse Specs — Living Spec

## Purpose

The Specs view is where a person finds a spec and sees where it stands without opening it. Without it, the only way to know which specs are in flight, finished or stalled is to read each folder's run record by hand.

## Requirements

### Specs are grouped by lifecycle, each group with a live count
<!-- touches: apps/vscode/src/features/specs/specExplorerProvider.ts -->

The Specs view SHALL sort every spec into Active, Completed or Archived by the status in the run record beside it, and show each group's count in its header. A spec with no recorded status, and a spec that finished implement but was never confirmed, SHALL sit in Active. A group with nothing in it SHALL not appear, Active SHALL start expanded and the other two collapsed, and the groups SHALL always appear in that order.

#### Scenario: an implemented spec nobody confirmed
- **WHEN** a spec's recorded status is implemented
- **THEN** it is listed under Active, not Completed

#### Scenario: no archived specs
- **WHEN** no spec in the workspace is archived
- **THEN** the tree shows no Archived group at all

### A spec row says where the spec stands without relying on color
<!-- touches: apps/vscode/src/features/specs/specExplorerProvider.ts, apps/vscode/src/features/specs/lastTransition.ts, apps/vscode/src/features/specs/specStatusLabel.ts, apps/vscode/src/core/utils/specDisplayName.ts -->

A spec row SHALL show the spec's recorded name, or its folder slug turned into readable words when none is recorded, and an icon that tells apart: nothing captured yet, a step in progress, implemented, completed, and running right now. Its description line SHALL show the last finished implement task, when there is one, and how long ago the most recent history entry happened. Its tooltip SHALL repeat the name, status, last activity and any running step in words. When two specs share a slug across spec directories, the row SHALL also show its parent directory.

#### Scenario: a spec stalled mid-implement
- **WHEN** the latest history entry is the finish of task T004, written 22 hours ago
- **THEN** the row's description reads `T004 · 22h ago`

#### Scenario: a spec that has not reached implement
- **WHEN** the latest history entry is a plan step boundary
- **THEN** the description shows only the relative time, and the tooltip names the plan activity

### Expanding a spec lists its pipeline's documents, each with its own state
<!-- touches: apps/vscode/src/features/specs/specExplorerProvider.ts, apps/vscode/src/features/specs/stepHistoryDerivation.ts -->

A spec SHALL expand into one row per document-producing step of that spec's own pipeline, the same pipeline the spec viewer draws, with extra markdown files in the folder nested under the step that claims them. Each document row SHALL read as Complete, In Progress, Not Started or not created, from the run record plus whether the file holds more than three non-blank lines. A step whose file is missing but whose sub-files or related files exist SHALL count as created.

#### Scenario: a finished step whose file is still a stub
- **WHEN** the run record says plan is done but `plan.md` holds two lines
- **THEN** the Plan row reads In Progress, not Complete

#### Scenario: a document that does not exist yet
- **WHEN** the tasks file is not on disk
- **THEN** the Tasks row shows `not created`, does nothing when clicked, and offers no open or reveal action

### Clicking a row opens it in the spec viewer
<!-- touches: apps/vscode/src/features/specs/specExplorerProvider.ts, apps/vscode/src/features/specs/specCommands.ts -->

Clicking a spec's name SHALL open that spec in the spec viewer and expand the row, while the chevron only expands or collapses. Clicking a document or related-file row SHALL open that document in the viewer. **Open Source File** on a document row SHALL open the raw file in a text editor instead.

#### Scenario: opening the raw markdown
- **WHEN** someone uses Open Source File on the Plan row
- **THEN** `plan.md` opens in a normal editor tab, not the viewer

### The filter narrows the tree by fuzzy match and is remembered
<!-- touches: apps/vscode/src/features/specs/specCommands.ts, apps/vscode/src/features/specs/specsFilterState.ts, apps/vscode/src/features/specs/fuzzyMatch.ts -->

**Filter…** SHALL keep only specs whose slug or recorded name contains the query's letters and digits in order, ignoring case and punctuation, and group counts SHALL reflect what is left. The input SHALL open prefilled with the current query, submitting an empty value SHALL clear it, and the query SHALL survive a restart of the workspace. When nothing matches, the view SHALL offer a one-click clear, and `SpecKit: Clear Filter` SHALL do the same from the Command Palette.

#### Scenario: a subsequence query
- **WHEN** the query is `ftr`
- **THEN** `filter-specs-tree` stays in the tree

#### Scenario: nothing matches
- **WHEN** the query matches no spec
- **THEN** the view shows "No specs match the current filter." with a Clear filter link and no install row

### Sort orders specs inside every group and is remembered
<!-- touches: apps/vscode/src/features/specs/specCommands.ts, apps/vscode/src/features/specs/specsSortMode.ts, apps/vscode/src/features/specs/specsSortState.ts -->

**Sort…** SHALL offer Number (the default, highest first), Name, Date Created, Date Modified and Workflow Step, with a check beside the current one. Ties SHALL fall back to the numeric prefix and then the name so the order never changes between refreshes. The choice SHALL survive a restart and SHALL never reorder the groups themselves.

#### Scenario: two specs at the same step
- **WHEN** sorting by Workflow Step and two specs are both at plan
- **THEN** the one with the higher number comes first

### One toolbar button collapses or expands every spec row
<!-- touches: apps/vscode/src/features/specs/specCommands.ts, apps/vscode/src/features/specs/specExplorerProvider.ts -->

The Specs toolbar SHALL show Collapse All or Expand All, whichever the tree currently calls for, and using it SHALL change every spec row at once. It SHALL leave the three groups as the person left them. Spec rows SHALL start collapsed.

#### Scenario: expanding everything
- **WHEN** someone presses Expand All with the Completed group collapsed
- **THEN** every visible spec row expands, Completed stays collapsed, and the button becomes Collapse All

### The tree follows the files on disk
<!-- touches: apps/vscode/src/features/specs/specCommands.ts, apps/vscode/src/features/specs/specExplorerProvider.ts -->

The tree SHALL list the specs found under the directories named in `speckit.specDirectories`, and SHALL refresh on its own shortly after anything under them is created, changed or deleted, including the run record. **Refresh** SHALL force the same re-read.

#### Scenario: an assistant finishes a step in a terminal
- **WHEN** the run record beside a spec is rewritten by a command the extension did not run
- **THEN** the row's icon, description and group update without a manual refresh

## Uncovered

- How spec directories are resolved from `speckit.specDirectories` patterns (nested layouts, change roots) is core behaviour this capability only consumes.
