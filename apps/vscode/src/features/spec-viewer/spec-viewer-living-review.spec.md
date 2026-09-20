# Spec Viewer Living Review — Living Spec

<!-- reviewed: 01379900 -->

## Purpose

What the reader does to confirm or change a living spec's requirements from the viewer: approving adopted drafts, removing requirements, and undoing either within the Undo window.

## Requirements

### Approving a requirement removes only its adopted marker
<!-- touches: apps/vscode/src/features/living-specs/livingDocs.ts -->

Approving one requirement, or all requirements in the tier on screen, SHALL delete their `adopted` markers and change nothing else in the file.

#### Scenario: one adopted requirement is approved
- **WHEN** the reader approves it
- **THEN** its marker is gone and every other line of the file is unchanged

### Approving the last adopted requirement clears the draft banner
<!-- touches: apps/vscode/src/features/living-specs/livingDocs.ts -->

When the last `adopted` marker goes, the `[DRAFT]` banner SHALL go with it. Approving the whole spec SHALL remove the banner even when no marker was left.

#### Scenario: the last adopted requirement in a tier is approved
- **WHEN** the reader approves it
- **THEN** the draft banner is removed and the panel re-renders without the DRAFT badge

#### Scenario: a draft with no adopted markers is approved whole
- **WHEN** the reader approves the spec
- **THEN** the draft banner is removed from the file

### Approval writes only to a living tier file inside the workspace
<!-- touches: apps/vscode/src/features/spec-viewer/messageHandlers.ts, apps/vscode/src/features/living-specs/livingSpecsModel.ts -->

An approval that names a file outside the workspace, or a file that is not a tier file, SHALL write nothing and be logged as refused.

#### Scenario: approval names a file outside the workspace
- **WHEN** the request reaches the extension
- **THEN** nothing is written and the refusal is logged

### Remove deletes a requirement after the reader confirms
<!-- touches: apps/vscode/src/features/spec-viewer/messageHandlers.ts, apps/vscode/src/features/living-specs/livingDocs.ts -->

Every requirement card SHALL offer Remove, which deletes the requirement and its scenarios up to the next heading once the reader confirms.

#### Scenario: the reader confirms Remove
- **WHEN** nothing in another capability aligns to the requirement
- **THEN** the requirement is gone from the file and the panel redraws

### A requirement another capability aligns to cannot be removed
<!-- touches: apps/vscode/src/features/living-specs/livingSpecsModel.ts -->

Remove SHALL be refused, with a message naming the capabilities, while a requirement in another capability aligns to it. A link from the requirement's own capability SHALL NOT block it.

#### Scenario: another capability aligns to it
- **WHEN** the reader picks Remove
- **THEN** nothing is written and the message names the capability that leans on it

### A removal that stands is recorded beside the spec
<!-- touches: apps/vscode/src/features/living-specs/livingDocs.ts -->

When a removal outlives its Undo window, one `requirement-removed` record naming the capability and the heading SHALL be appended to the `.spec-context.json` beside the spec, creating the file when absent.

#### Scenario: the Undo window runs out
- **WHEN** the window expires, a newer action replaces it, or the panel closes
- **THEN** one removal record is appended beside the spec

### Approve all and Remove can be undone for five seconds
<!-- touches: apps/vscode/src/features/spec-viewer/messageHandlers.ts -->

For five seconds after Approve all or Remove, Undo SHALL restore the file byte for byte. An undone removal SHALL leave no record.

#### Scenario: Undo right after Approve all
- **WHEN** the reader presses Undo within five seconds
- **THEN** the file is byte-identical to before the approval

### Undo never overwrites a change made after the action
<!-- touches: apps/vscode/src/features/spec-viewer/messageHandlers.ts -->

When the file no longer reads as the action left it, Undo SHALL write nothing and tell the reader the file changed.

#### Scenario: the file changed during the window
- **WHEN** the reader presses Undo
- **THEN** nothing is written and a warning says the file changed
