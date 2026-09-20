# Reshape a Step — Living Spec

## Purpose

A project changes what a step tells the assistant: it rewrites a node, swaps one, reorders, regroups, reshapes the document, or adds a step of its own. Each change has to be one the project can take back, and none of them may touch what Companion ships.

## Requirements

### Saving an edit is what makes a node the project's own
<!-- touches: apps/vscode/src/features/pipeline-builder/**, apps/vscode/webview/src/pipeline-builder/Inspector.tsx -->

**Edit** SHALL open a node's instructions as stored, with the markers for shared blocks intact, and saving SHALL write the project's copy to `.specify/companion/nodes/<step>/<node>.md` with the node's metadata carried across. The shipped file SHALL never be written, and from the save on the project's copy is what the assistant reads and the node reads `yours`. A step's own preamble is edited the same way.

#### Scenario: a shipped node is edited for the first time
- **WHEN** someone saves an edit to a node the project never touched
- **THEN** a project copy is created, the shipped file is unchanged, and the form said beforehand that saving writes a copy

### A rewritten node can go back to the shipped one
<!-- touches: apps/vscode/src/features/pipeline-builder/builderPanel.ts, apps/vscode/webview/src/pipeline-builder/Inspector.tsx -->

**Use the shipped node** SHALL be offered only for a node the project rewrote and that Companion ships. It SHALL send the project's copy to the trash and offer **Undo** on the status line. A node that exists only in the project SHALL NOT offer it and SHALL be refused if asked, with **Remove from the run** named as the way to stop running it.

#### Scenario: a node the project invented
- **WHEN** the open node has no shipped version
- **THEN** Use the shipped node is not offered and the file cannot be deleted from the panel

### A step's order and grouping are always written together
<!-- touches: apps/vscode/webview/src/pipeline-builder/**, apps/vscode/src/features/pipeline-builder/builderPanel.ts, apps/vscode/src/features/specs/pipelineGraph.ts -->

Adding, removing, moving or replacing a node SHALL write the step's whole node order and whole phase grouping in one change, so a node is never in the order without a phase or in a phase without a place in the order. A change the configuration refuses SHALL leave the file untouched, put the board back to what is on disk, and give the reason in the panel.

#### Scenario: a refused drag
- **WHEN** a node is dropped somewhere the configuration will not accept
- **THEN** the board snaps back and the panel says why

### A node moves only when nothing downstream holds it
<!-- touches: apps/vscode/webview/src/pipeline-builder/Canvas.tsx, apps/vscode/webview/src/pipeline-builder/Inspector.tsx -->

A free node SHALL move by dragging, including into another phase, or by **Move up** and **Move down** on its Order row. A held node SHALL refuse a drag and show what holds it instead of move buttons.

#### Scenario: moving without a mouse
- **WHEN** Move up is pressed on a free node
- **THEN** the node moves one place earlier inside its phase and the status line says it moved

### Nodes are taken out, put back and swapped without deleting anything
<!-- touches: apps/vscode/webview/src/pipeline-builder/**, apps/vscode/src/features/pipeline-builder/builderPanel.ts -->

**Remove from the run** SHALL stop a node running while keeping its file, offer **Undo**, drop a phase the removal emptied, and SHALL NOT be offered for the last node a step has. **Add node** in a phase's `+` menu SHALL offer only what this step can run and is not running, each row saying what the node does and whether it is a shipped add-on or one the project removed. A node with alternatives SHALL show **Replace**, and picking one puts it in the same place and carries every hook attached to the node it replaced.

#### Scenario: replacing a node that has hooks
- **WHEN** a node with attached hooks is replaced by an alternative
- **THEN** the hooks are attached to the alternative and keep running

### Phases are the project's to name, split and merge
<!-- touches: apps/vscode/webview/src/pipeline-builder/Canvas.tsx, apps/vscode/webview/src/pipeline-builder/Menu.tsx, apps/vscode/src/features/specs/pipelineGraph.ts -->

A phase's `+` menu SHALL always list Add hook, Add node, Rename phase, Split phase and Merge, with a row that cannot run here greyed, announced as unavailable, and carrying its reason. Renaming a phase SHALL carry the hooks anchored to it. Merging folds a phase into its neighbour and names the direction, the only phase of a step cannot be removed, and a one-node phase cannot be split. Phases are not reorderable. A step with no phase SHALL offer its first one.

#### Scenario: splitting a one-node phase
- **WHEN** the menu opens on a phase holding one node
- **THEN** Split phase is listed, greyed, and says there is nothing to split off

### A step's document is reshaped section by section
<!-- touches: apps/vscode/webview/src/pipeline-builder/TemplateForm.tsx, apps/vscode/src/features/specs/pipelineGraph.ts -->

The document shape chip on a step SHALL open one row per `##` section of its template. A section with alternatives SHALL offer each fragment with its summary plus **As shipped**, and a section with none SHALL draw no control and say nothing else is written for it. Choosing As shipped SHALL remove the entry instead of recording a choice, so an untouched step builds byte-identical to the shipped one.

#### Scenario: restoring a section
- **WHEN** As shipped is picked for a replaced section
- **THEN** the section's entry leaves the configuration and the chip's count drops by one

### A project can add a step or hand one to a single document
<!-- touches: apps/vscode/webview/src/pipeline-builder/AttachForm.tsx, apps/vscode/src/features/pipeline-builder/builderPanel.ts, apps/vscode/src/features/specs/pipelineGraph.ts -->

**Add step** in the header appends a step, and the `+` between two lanes opens the same form with **Runs after** naming the step to its left. The form SHALL ask for a name, a display name, where it runs or that it stays out of the run, and what it writes, and SHALL refuse a name that cannot be a command or that a step already has. It writes `.specify/companion/nodes/<name>/` seeded runnable and opens its one node. From a step's preamble, replacing the whole step SHALL seed one project document from what the step says today, point the step at it, and open it. If that change is refused the seeded file SHALL be removed.

#### Scenario: a name already in use
- **WHEN** the new step is given the name of an existing step
- **THEN** the form says so and nothing is written
