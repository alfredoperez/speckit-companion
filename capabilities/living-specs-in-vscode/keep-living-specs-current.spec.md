# Keep Living Specs Current — Living Spec

## Purpose

Nothing updates a living spec on its own. This capability is the set of actions in VS Code that start the work: setting living specs up, adopting code areas, and asking the assistant to check, sync, move or update specs. The extension asks the questions a picker answers well, checks the shape of what gets saved, then hands the rest to the configured assistant. Without it a person has to remember seven slash commands and their arguments.

## Requirements

### Setting up asks one question and writes the registry
<!-- touches: apps/vscode/src/features/living-specs/livingSpecsCommands.ts -->

Set Up Living Specs SHALL ask where specs should live, next to the code or in one central folder, and write a `living-specs.yml` at the workspace root that is enabled, records that layout, carries the default exemptions and lists no capabilities. It then offers to adopt a code area. When a registry already exists it is opened instead and nothing is written.

#### Scenario: backing out of the layout question
- **WHEN** someone dismisses the layout picker
- **THEN** no file is written

#### Scenario: a registry already exists
- **WHEN** Set Up Living Specs runs in a project that has `living-specs.yml`
- **THEN** a message says so and the file opens in the editor, unchanged

### Adopting asks which areas, then hands over to the assistant
<!-- touches: apps/vscode/src/features/living-specs/livingSpecsCommands.ts, apps/vscode/src/features/spec-viewer/messageHandlers.ts, apps/vscode/webview/src/spec-viewer/App.tsx -->

Adopt Code Area SHALL offer the project's top-level folders, one level inside the usual source roots, "The whole project" and "Type a path", allow several to be picked, and send `/speckit.companion.living-adopt` with those areas to the assistant. The layout is passed along only when setup asked for it a moment earlier, so the person is never asked twice. A capability whose spec does not exist yet shows "Adopt this area" in the viewer, which skips the picker and adopts the folders that capability covers.

#### Scenario: the whole project is picked with other folders
- **WHEN** someone ticks "The whole project" and two folders
- **THEN** the assistant is asked to adopt `.` and nothing else

#### Scenario: adopting from an empty capability
- **WHEN** a registered capability has no spec and someone presses "Adopt this area"
- **THEN** adoption starts for that capability's folders without asking which area

### Checks and syncs are handed to the assistant, scoped to where they were launched
<!-- touches: apps/vscode/src/features/living-specs/livingSpecsCommands.ts, package.json -->

Check for Drift, Check Requirement Coverage, Validate living specs, Sync living specs from my changes and Move Living Spec SHALL each send the matching `/speckit.companion.living-*` command to the configured assistant. Launched from a capability row or an open living spec the command names that capability, and launched from the view title or the command palette it covers every capability. Move first asks whether the destination is next to the code or central. The extension runs none of this itself and hears nothing back: the tree and any open panel update from what lands on disk.

#### Scenario: drift from a row
- **WHEN** someone picks Check for Drift on the `checkout` row
- **THEN** the assistant receives the drift command for `checkout` only

#### Scenario: move is cancelled
- **WHEN** someone dismisses the destination picker
- **THEN** nothing is sent

### Update to Match Code asks for an edit, not a rewrite
<!-- touches: apps/vscode/src/features/living-specs/livingSpecsCommands.ts, apps/vscode/src/features/living-specs/livingSpecsModel.ts -->

Update to Match Code SHALL be offered only on a drifted capability, as a row button, a row menu item and the viewer's Sync button, and all three send the same request. The request is a plain instruction that names the capability and the spec file to edit in place, lists the files that changed since the spec's last commit, and tells the assistant to update rather than regenerate so existing requirements, clarifications and scenarios survive. When the changed files cannot be determined the request says so and tells the assistant to inspect the capability's own files.

#### Scenario: a capability in sync
- **WHEN** a capability has no drift
- **THEN** neither its row nor its viewer offers the update action

#### Scenario: git is unavailable when the button is pressed
- **WHEN** the changed-file lookup fails
- **THEN** the request is still sent, stating that the list could not be determined

### Saving a spec shows what is wrong with its shape
<!-- touches: apps/vscode/src/features/specs/specShapeDiagnostics.ts, apps/vscode/src/features/specs/specShapeCheck.ts -->

In a project that keeps living specs, saving a spec document SHALL publish each shape finding as a problem on the line it is about, said in the same words the terminal check uses, and clear it on the next save that fixes it. A living spec is judged against the living shape and a feature spec against its delta sections. A project with no living specs, or one whose registry cannot be read, publishes nothing.

#### Scenario: a scenario with no outcome
- **WHEN** someone saves a living spec whose scenario has a WHEN and no THEN
- **THEN** a problem appears on that line, and saving again with the THEN written clears it

#### Scenario: a project that does not use living specs
- **WHEN** a `*.spec.md` is saved with living specs switched off
- **THEN** no problems are reported

### An open living spec always offers its next action
<!-- touches: apps/vscode/webview/src/spec-viewer/components/footer/LivingFooter.tsx -->

The bar under an open living spec SHALL state the capability's condition in words: no spec yet, drift unknown, how many requirements drifted, source files changed, or in sync. It always offers Adopt an area and Validate, offers Sync only when drift was found, and offers the approve action only while the spec is a draft or has adopted requirements.

#### Scenario: drift that maps to requirements
- **WHEN** two requirements' files drifted
- **THEN** the bar reads "2 requirements drifted" and Sync is the primary button

## Uncovered

- Whether Check Requirement Coverage on a row really "writes" a coverage file, as the row tooltip says, depends on the assistant-side command and was not checked here.
