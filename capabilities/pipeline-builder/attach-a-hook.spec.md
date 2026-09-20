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

Clicking one of the project's hooks SHALL open the form filled from it, with **Remove** offered. Saving without moving it SHALL replace it in place. Saving it to another anchor or side SHALL move it as one change, and if the hook cannot be taken off its old place nothing SHALL be added at the new one. A hook an extension registered, or a parked hook, SHALL offer no edit.

#### Scenario: a move is refused
- **WHEN** the removal half of a move is refused
- **THEN** the hook stays where it was and no second copy appears

### Hooks are written to the configuration in force
<!-- touches: apps/vscode/src/features/pipeline-builder/builderPanel.ts, apps/vscode/src/features/specs/pipelineGraph.ts -->

A hook SHALL be written to `.specify/companion.yml`, or to the named workflow's file when the project is on one, and SHALL take effect only after a build. Attaching an already registered command adds a second invocation at the finer boundary and SHALL NOT move or remove the registration it already has.

#### Scenario: the project is on a named workflow
- **WHEN** a hook is added while a named workflow is in force
- **THEN** it is written to that workflow's file and the block heading names that file
