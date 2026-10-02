# Attach a Hook — Living Spec

## Purpose

Attaching the project's own work to the run is the commonest change a project makes, and the one that needs no files. Without the form a hook is YAML written from memory, and a misspelt name becomes a hook that invokes nothing.

## Requirements

### Work attaches before or after a node, a phase or a step
<!-- touches: apps/vscode/webview/src/pipeline-builder/Canvas.tsx, apps/vscode/webview/src/pipeline-builder/AttachForm.tsx -->

**Add hook** SHALL be offered from every phase's `+` menu, from a node's side panel and from the dotted slot between two nodes, and the form SHALL open already naming the anchor and the side it was opened from. Placement comes first in the form, as when and where in one row, and both can be changed there.

#### Scenario: the slot between two nodes
- **WHEN** someone clicks the `+` between two node cards
- **THEN** the form opens on that gap's anchor, with nothing attached until it is confirmed

### A hook is one of four kinds
<!-- touches: apps/vscode/webview/src/pipeline-builder/AttachForm.tsx, apps/vscode/webview/src/pipeline-builder/hookKinds.ts -->

A hook SHALL be a **Skill**, an **Instruction**, a **Command** (a shell line) or a **Node** from `.specify/companion/nodes/`, with one line of help for the kind selected. A skill hook MAY carry an optional note, and a note typed under Skill SHALL be dropped when the kind changes.

#### Scenario: changing kind mid-form
- **WHEN** a value was chosen under one kind and the kind is changed
- **THEN** the choice is not carried into the new kind

### Each kind offers what the project actually has
<!-- touches: apps/vscode/webview/src/pipeline-builder/AttachForm.tsx -->

Every kind SHALL offer **Choose…** listing what this project has for it, while the field stays free to type in. Skill and Node list their names and filter as typed. Instruction lists every hook command the project's registries hold, each saying what it does, who registered it and where it usually attaches, and picking one SHALL write an editable sentence asking for that command. Command SHALL NOT offer that list, because a registered command is not something a shell can run.

#### Scenario: a command registered at several steps
- **WHEN** a registry places one command at more than one step
- **THEN** the list names no usual place for it

#### Scenario: nothing to offer
- **WHEN** the project has nothing for the selected kind
- **THEN** the list says it is empty instead of showing an empty control

### A hook can be changed, moved or taken out
<!-- touches: apps/vscode/webview/src/pipeline-builder/AttachForm.tsx, apps/vscode/src/features/pipeline-builder/builderPanel.ts, apps/vscode/src/features/specs/pipelineGraph.ts -->

Clicking one of the project's hooks SHALL open the form filled from it, with **Remove** offered. Saving without moving it SHALL replace it in place. Saving it to another anchor or side SHALL move it in one write, carrying any change to what it runs, and close the form, and a move that is refused SHALL leave the configuration exactly as it was. A hook an extension registered, or a parked hook, SHALL offer no edit.

#### Scenario: a move carries an edit
- **WHEN** a hook after one node is given a new command and saved to run before another node
- **THEN** the configuration holds it only before the new node, running the new command, and the form closes

#### Scenario: a move is refused
- **WHEN** a hook is saved to another anchor while the shipped workflow is in force
- **THEN** the hook stays where it was, no second copy appears, and the panel says why

### Hooks are written to the configuration in force
<!-- touches: apps/vscode/src/features/pipeline-builder/builderPanel.ts, apps/vscode/src/features/specs/pipelineGraph.ts -->

A hook SHALL be written to `.specify/companion.yml`, or to the named workflow's file when the project is on one, and SHALL take effect only after a build. Attaching an already registered command adds a second invocation at the finer boundary and SHALL NOT move or remove the registration it already has.

#### Scenario: the project is on a named workflow
- **WHEN** a hook is added while a named workflow is in force
- **THEN** it is written to that workflow's file and the block heading names that file

### A project hook can be dragged to another place on its step
<!-- touches: apps/vscode/webview/src/pipeline-builder/Canvas.tsx, apps/vscode/webview/src/pipeline-builder/hookMoves.ts, apps/vscode/webview/src/pipeline-builder/index.tsx, apps/vscode/webview/styles/pipeline-builder.css -->

One of the project's hooks SHALL drop onto another hook's upper or lower half, a node card's upper or lower half, a dotted slot, a hook block or a phase heading, and run from there after one write.

#### Scenario: moving to another node
- **WHEN** a hook after one node is dropped on the upper half of another node's card
- **THEN** the configuration holds it before that node and not after the first, and the status line says where it went

#### Scenario: reordering at one anchor
- **WHEN** the third hook after a node is dropped on the upper half of the first
- **THEN** it runs first there and the status line says it moved up

### A move changes only the moved hook's lines
<!-- touches: apps/speckit-extension/scripts/config_write.py -->

A move SHALL keep the moved entry's exact text and leave every other line of the configuration as it was, comments included, apart from an anchor key the move emptied.

#### Scenario: moving an anchor's only hook
- **WHEN** the only hook at an anchor is moved to another anchor in a file with comments
- **THEN** the diff touches only that entry's lines and removes the emptied anchor key, and every comment is unchanged

### The hook form moves a hook one place up or down
<!-- touches: apps/vscode/webview/src/pipeline-builder/AttachForm.tsx, apps/vscode/webview/src/pipeline-builder/index.tsx -->

The hook form SHALL offer **Move up** and **Move down** on an **Order** row for a project hook, each moving it one place within its side and anchor and keeping the form open on it, and each SHALL be unavailable with its reason at the matching edge.

#### Scenario: moving from the keyboard
- **WHEN** Move up is pressed on the second of two hooks in its form
- **THEN** it becomes the first and the form still shows it

#### Scenario: already first
- **WHEN** the form is open on the first hook at its anchor
- **THEN** Move up is unavailable and says the hook is already first

### A move is announced only once its write answers
<!-- touches: apps/vscode/webview/src/pipeline-builder/index.tsx, apps/vscode/webview/src/pipeline-builder/AttachForm.tsx, apps/vscode/src/features/pipeline-builder/builderPanel.ts -->

The status line and the form's live region SHALL say nothing about a move until its write answers, then read the outcome on success and the reason on refusal.

#### Scenario: a refused move from the form
- **WHEN** Move down is pressed and the write is refused
- **THEN** the live region never says the hook moved and reads the refusal's reason

### Extension and parked hooks neither drag nor take a drop
<!-- touches: apps/vscode/webview/src/pipeline-builder/Canvas.tsx -->

A hook an extension registered, or a parked hook, SHALL take no drop, and a drag started on one SHALL not start and SHALL show the reason in the status line.

#### Scenario: dragging an extension's hook
- **WHEN** a drag starts on a hook the git extension registered
- **THEN** nothing moves and the status line says the git extension registered it and it is not moved in this panel

### A drop in another step's lane is refused before anything is written
<!-- touches: apps/vscode/webview/src/pipeline-builder/Canvas.tsx -->

A hook SHALL move only within its own step, and a drop in another step's lane SHALL write nothing and say why in the status line.

#### Scenario: dropping in another step
- **WHEN** a hook of the plan step is dropped in the implement lane
- **THEN** the configuration is unchanged and the status line says a hook moves within its own step

### A move to a place the step does not have is refused before it is written
<!-- touches: apps/speckit-extension/scripts/config_write.py, apps/vscode/src/features/specs/pipelineGraph.ts -->

The writer SHALL refuse a move to a node or phase the step does not have, or to a name that resolves to a different boundary than the one dropped on, and leave the file as it was.

#### Scenario: a phase that shares a node's name
- **WHEN** a hook is dropped on the `orchestrate` phase of a step that also has an `orchestrate` node
- **THEN** the move is refused with the reason and the file is byte for byte unchanged
