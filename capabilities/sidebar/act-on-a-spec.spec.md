# Act on a Spec — Living Spec

## Purpose

A person moves a spec through its life from the tree: finish it, shelve it, bring it back, pick it up where it stopped, or get rid of it. Without these actions the only way to change a spec's standing is to hand-edit its run record.

## Requirements

### Hover and right-click offer the same menu, filtered to what applies
<!-- touches: package.json, apps/vscode/src/features/specs/specExplorerProvider.ts -->

A spec row SHALL offer the same actions from its **More Actions…** hover button and from its right-click menu, in the same order: Set Status, then the lifecycle actions that apply, then Copy Spec Name and Copy Spec Path, then the two reveal actions, then Delete alone at the bottom. Mark Complete SHALL appear only on a spec that is not completed or archived, Archive on any spec that is not archived, and Reactivate only on a completed or archived spec.

#### Scenario: an archived spec
- **WHEN** someone opens the menu on an archived spec
- **THEN** the lifecycle group holds Reactivate only

### Mark Complete, Archive and Reactivate move a spec between groups
<!-- touches: apps/vscode/src/features/specs/specCommands.ts, apps/vscode/src/features/specs/stepLifecycle.ts -->

Mark Complete and Archive SHALL record the new status in the spec's run record, and the spec SHALL move to the matching group at once. Reactivate SHALL return a completed or archived spec to Active with the in-progress status of the step it was last on. Each change SHALL be written as a new history entry, never by rewriting past ones.

#### Scenario: reactivating a spec archived during plan
- **WHEN** someone reactivates an archived spec whose current step is plan
- **THEN** it returns to Active with a planning status

### Several specs can be changed in one action
<!-- touches: apps/vscode/src/features/specs/specCommands.ts, apps/vscode/src/features/specs/selectionContextKeys.ts, package.json -->

With several spec rows selected, Mark Complete, Archive and Reactivate SHALL apply to the whole selection. Each group header SHALL offer the same actions over every spec currently visible in that group, after a confirmation that names the count. Specs already in the target status SHALL be skipped silently, and the closing notice SHALL count only the specs that changed.

#### Scenario: a bulk action under an active filter
- **WHEN** a filter leaves 3 of 40 active specs visible and someone chooses Archive All on Active
- **THEN** the confirmation names 3 specs and only those are archived

#### Scenario: nothing eligible
- **WHEN** every spec in the group is already in the target status
- **THEN** nothing is asked and nothing is written

### Set Status forces a spec to any lifecycle status after a confirmation
<!-- touches: apps/vscode/src/features/specs/specCommands.ts, apps/vscode/src/features/specs/stepLifecycle.ts -->

**Set Status…** SHALL offer specifying, specified, planning, planned, ready-to-implement, implementing, implemented and completed, and SHALL always ask for confirmation because it bypasses the normal lifecycle. Forcing a status SHALL also point the spec's current step at the step that owns that status and record the override as made by the user, so the spec viewer's actions line up with the forced position.

#### Scenario: recovering a stranded spec
- **WHEN** someone forces a spec stuck on specify to `planned`
- **THEN** its current step becomes plan, recorded as finished, so the viewer stops showing it on specify

#### Scenario: the write fails
- **WHEN** the run record cannot be written
- **THEN** an error says the status could not be set and the tree is left as it was

### Resume hands the spec back to the assistant from where it stopped
<!-- touches: apps/vscode/src/features/specs/specCommands.ts, apps/vscode/src/features/specs/profileDispatch.ts, package.json -->

A Resume action SHALL appear on hover for a spec that is in progress or has its tasks ready, and only when the Companion spec-kit extension is installed in the project. It SHALL send one `/speckit.companion.resume <spec path>` command to the configured assistant and do nothing else. It has no stock Spec Kit equivalent, so without the extension it SHALL send nothing and offer the install instead.

#### Scenario: an implemented spec
- **WHEN** a spec has finished implement
- **THEN** its row offers no Resume action

### Delete removes the spec folder after a confirmation
<!-- touches: apps/vscode/src/features/specs/specCommands.ts -->

Delete SHALL ask before acting, say that it cannot be undone, and then remove the spec's whole folder and refresh the tree.

#### Scenario: cancelling
- **WHEN** someone dismisses the confirmation
- **THEN** nothing on disk changes

### Copy and reveal work on what the row points at
<!-- touches: apps/vscode/src/features/specs/specCommands.ts -->

Copy Spec Name SHALL put the spec's folder slug on the clipboard and Copy Spec Path its workspace-relative path. Reveal in VS Code Explorer and Reveal in File Manager SHALL work on any file-backed row in any SpecKit view, and SHALL show an error instead of failing silently when the target no longer exists.

#### Scenario: revealing a folder deleted outside the editor
- **WHEN** the row's folder was removed on disk and someone chooses Reveal in File Manager
- **THEN** an error names the missing path

## Uncovered

- Running the workflow steps themselves (Specify, Plan, Tasks, Implement, Clarify, Analyze, Checklist, custom commands) is registered beside these actions but is driven from the spec viewer, not the tree. It belongs to the pipeline capabilities.
