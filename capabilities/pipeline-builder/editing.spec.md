# Pipeline Builder Editing — Living Spec

## Purpose

The actions that change what the board shows: attaching a hook, replacing what a step's document looks like, and reading or drafting a node's instructions — plus the one menu control every picker in the panel shares.

## Requirements

### A menu's disabled row stays visible, with the reason it cannot be picked
<!-- touches: apps/vscode/webview/src/pipeline-builder/Menu.tsx -->

An option a menu cannot currently act on SHALL still be shown, disabled, so its note can say why, rather than being left out where nothing would explain the gap.

#### Scenario: a phase menu offers Split when the phase holds one node
- **WHEN** the menu opens
- **THEN** Split is shown disabled with a note saying there is nothing to split off

### Opening a menu by keyboard lands on its first enabled row
<!-- touches: apps/vscode/webview/src/pipeline-builder/Menu.tsx -->

Opening a menu from the keyboard SHALL move focus to its first non-disabled option, and the arrow keys, Home and End SHALL move focus among the options while it is open.

#### Scenario: every option in a menu is disabled
- **WHEN** it is opened from the keyboard
- **THEN** focus stays on the trigger rather than landing on a row that cannot be picked

### A menu closes on an outside click or Escape and returns focus to its trigger
<!-- touches: apps/vscode/webview/src/pipeline-builder/Menu.tsx -->

Clicking outside an open menu, or pressing Escape while it is open, SHALL close it and return keyboard focus to the control that opened it.

#### Scenario: the reader presses Escape while a menu is open
- **WHEN** the key is handled
- **THEN** the menu closes and its trigger button is focused

### Moving a hook to a different anchor removes it from the old one and adds it at the new one
<!-- touches: apps/vscode/webview/src/pipeline-builder/AttachForm.tsx -->

Editing a hook so it attaches somewhere else, or on the other side of the same anchor, SHALL be written as a removal at the original position plus an addition at the new one, never as a replace at the original index, because that index means nothing once the anchor has changed.

#### Scenario: a hook is edited from "after node A" to "before node B"
- **WHEN** the edit is saved
- **THEN** node A's `after` list loses it and node B's `before` list gains it, and nothing at node A's old index is overwritten

### A spec-kit command is offered as an instruction, never as a shell command
<!-- touches: apps/vscode/webview/src/pipeline-builder/AttachForm.tsx, apps/vscode/webview/src/pipeline-builder/hookKinds.ts -->

A registered spec-kit command SHALL be offered under the Instruction kind as the sentence that asks for it, and never under Command, because a Command hook renders as a shell line and the command is not one.

#### Scenario: `speckit.git.commit` is chosen from the Instruction picker
- **WHEN** it is picked
- **THEN** the field is filled with the sentence that asks the assistant to run it, not the raw command name

### A hook name is chosen from what the project actually has, with the field still free to type one
<!-- touches: apps/vscode/webview/src/pipeline-builder/AttachForm.tsx -->

Choosing a Skill or a Node hook SHALL offer only the names this project has for that kind, narrowing as the reader types; the field SHALL stay editable regardless, so a name the list does not carry can still be entered.

#### Scenario: the Skill kind is picked and the project has three skills
- **WHEN** "Choose…" is opened
- **THEN** exactly those three are listed, narrowing further as more is typed

### A new step or workflow name is refused before anything is written
<!-- touches: apps/vscode/webview/src/pipeline-builder/AttachForm.tsx -->

A new step's or workflow's name SHALL be refused, with the reason shown beside the field, when it is not lowercase letters, digits and dashes, or when a step or workflow of that name already exists; the create action SHALL stay disabled until the name is clean.

#### Scenario: a name with a space or an uppercase letter is typed
- **WHEN** the field is read
- **THEN** the reason is shown and the create action stays disabled

### A step's document section returns to the shipped shape by removing the entry, not naming it
<!-- touches: apps/vscode/webview/src/pipeline-builder/TemplateForm.tsx -->

Restoring a template section to "As shipped" SHALL remove that section's override entirely, since an absent entry already means the shipped words, rather than writing a value that says "shipped".

#### Scenario: a reshaped section is restored
- **WHEN** "As shipped" is picked for it
- **THEN** the section has no override left in the configuration

### A section with no written alternatives offers no control to operate
<!-- touches: apps/vscode/webview/src/pipeline-builder/TemplateForm.tsx -->

A template section for which no fragment exists SHALL be shown with a line saying nothing else is written for it, and SHALL offer no picker, since a control with one dead option invites a click that changes nothing.

#### Scenario: a section has no alternative fragments
- **WHEN** the template form renders its row
- **THEN** it reads "As shipped" as a fact with no menu beside it

### Edit is unavailable until a node's instructions have finished loading
<!-- touches: apps/vscode/webview/src/pipeline-builder/Inspector.tsx -->

The Edit action SHALL stay disabled while a node's body is still being read, and SHALL open a draft seeded from the node's stored text, fences intact, once it is available.

#### Scenario: a node is selected and its body has not arrived yet
- **WHEN** the panel renders
- **THEN** Edit is disabled and the pane shows that it is still reading

### Canceling a draft discards it without writing anything
<!-- touches: apps/vscode/webview/src/pipeline-builder/Inspector.tsx -->

Cancelling an in-progress edit SHALL close the draft and leave the node exactly as it was, and the pane SHALL say whether saving would create the project's first copy of this node or overwrite one that already exists.

#### Scenario: a node that is already the project's own is being edited
- **WHEN** the draft is open
- **THEN** the pane says saving will overwrite this project's copy, not that it will create one

## Uncovered

_None: `AttachForm.tsx`, `TemplateForm.tsx`, `Menu.tsx`, `hookKinds.ts` and the editing half of `Inspector.tsx` were read in full._
