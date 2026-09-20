# Read a Spec — Living Spec

## Purpose

A person opens a workflow spec and reads its documents as a page instead of as raw markdown files. Without this, the spec, plan and tasks of a run are three unrelated files and nobody can tell which belong together, which exist, or which went out of date.

## Requirements

### A spec has one viewer tab
<!-- touches: apps/vscode/src/features/spec-viewer/specViewerProvider.ts, apps/vscode/src/features/spec-viewer/panelRegistry.ts -->

Each spec folder SHALL have at most one viewer tab. Opening any document of a spec that already has a tab, including a sub-document nested in its folder, SHALL show that document in the existing tab and bring the tab forward.

#### Scenario: a second document of the same spec is opened
- **WHEN** the viewer is showing a spec's Spec document and the person opens that spec's plan from the sidebar
- **THEN** the same tab switches to the Plan document and no second tab opens

### Opening a spec lands on the Overview, opening a document lands on that document
<!-- touches: apps/vscode/src/features/spec-viewer/specViewerProvider.ts, apps/vscode/webview/src/spec-viewer/signals.ts, apps/vscode/webview/src/spec-viewer/overviewModel.ts -->

Opening the spec as a whole SHALL land on the Overview, and opening a named document SHALL land on that document. A choice the reader makes inside the viewer holds until the next time the spec or a document is opened from outside, which decides again. The Overview is offered only when the run record holds something and the `speckit.viewer.activityPanel` setting is on. Otherwise the viewer shows the document.

#### Scenario: the spec is reopened after a document was read
- **WHEN** a tab that was last showing the Plan is reopened by clicking the spec's name
- **THEN** it shows the Overview, not the Plan

#### Scenario: nothing was recorded
- **WHEN** a spec whose run record is empty is opened as a whole
- **THEN** the viewer shows the first document that exists and offers no Overview

### The rail lists the documents of the workflow the spec recorded
<!-- touches: apps/vscode/src/features/spec-viewer/documentScanner.ts, apps/vscode/webview/src/spec-viewer/components/NavigationBar.tsx -->

The rail SHALL list one entry per workflow step that produces a document, using the workflow the spec recorded when it was created, so a custom workflow gets its own rail. Steps that only perform an action, such as Implement and Mark Complete, SHALL have no entry. A step's own sub-documents and sub-folders nest under that step, and any other markdown file in the spec folder is listed as a related document.

#### Scenario: the built-in workflow
- **WHEN** a spec created with the built-in workflow is opened
- **THEN** the rail shows Spec, Plan and Tasks, with research and data-model files nested under Plan and no Implement entry

### Any document that exists can be opened at any time
<!-- touches: apps/vscode/webview/src/spec-viewer/components/StepTab.tsx, apps/vscode/src/features/spec-viewer/panelStateComputer.ts -->

A rail entry SHALL be clickable whenever its document exists on disk, whether the run is behind it, on it or past it, and the first entry SHALL always be clickable. An entry is locked only when a step is running, the entry comes after that step, it is not the entry being read, and its document does not exist yet. A locked entry says why in its tooltip. Clicking an entry SHALL never change which step the run is on.

#### Scenario: reading back while implement runs
- **WHEN** implement is running and the person opens the Spec document
- **THEN** the Spec document shows, and the status badge and the footer keep reporting the implement step

#### Scenario: a later step during a running one
- **WHEN** plan is running and tasks.md does not exist
- **THEN** the Tasks entry is disabled with a tooltip naming the running step

### Spec Kit's conventions render as structure and everything else as plain markdown
<!-- touches: apps/vscode/webview/src/spec-viewer/markdown/** -->

The viewer SHALL render the shapes Spec Kit writes as structured elements: a bullet led by a bold two-to-five capital letter prefix, hyphen and number becomes a requirement row, an Acceptance Scenarios list keeps each scenario as one sentence with Given, When and Then emphasised, a `## Phase N:` heading becomes a phase header, a task line becomes a checkbox with its `[P]` and `[US#]` markers as chips, and a Mermaid fence becomes a diagram with zoom controls. Text that matches none of these SHALL render as ordinary markdown, and the file on disk is never rewritten by rendering.

#### Scenario: a requirement with a custom prefix
- **WHEN** a bullet reads `- **SEC-003** Tokens expire after one hour`
- **THEN** it renders as a labelled requirement row like an `FR-` bullet would

#### Scenario: a bullet that matches no convention
- **WHEN** a bullet has no prefix of that shape
- **THEN** it renders as an ordinary list item

### A document is shown, never run
<!-- touches: apps/vscode/webview/src/spec-viewer/markdown/inline.ts, apps/vscode/webview/src/spec-viewer/markdown/renderer.ts, apps/vscode/src/features/spec-viewer/html/generator.ts -->

Text from a spec SHALL reach the page as the characters that were typed, so markup written inside a document renders as visible text and nothing in a document can run as code or break out of the element or the attribute it was placed in. The only markup the viewer emits for a document is the structure it recognised itself, and the only scripts the page runs are the ones the viewer loads by name.

#### Scenario: a document containing markup
- **WHEN** a spec contains a line of raw HTML, including a script tag
- **THEN** the line appears as text and nothing is executed

#### Scenario: a quote inside a path
- **WHEN** a path in backticks contains a quote character
- **THEN** it shows in the file control as typed and does not become markup

### The viewer follows the files on disk
<!-- touches: apps/vscode/src/features/spec-viewer/specViewerProvider.ts, apps/vscode/webview/src/spec-viewer/messageHandlers.ts -->

An open viewer SHALL re-render when the document it shows changes on disk, and SHALL switch to a workflow document the moment that document is first created. A change to the run record SHALL refresh the header, rail and footer without reloading the document or losing the reader's place. When the document being read is deleted, the viewer says so instead of showing stale content.

#### Scenario: the plan appears during a run
- **WHEN** the viewer is showing the Spec and the assistant writes plan.md for the first time
- **THEN** the viewer switches to the Plan document

#### Scenario: the run record changes
- **WHEN** a step closes and the run record is rewritten while the reader is halfway down the Spec
- **THEN** the badge, rail and footer update and the document stays where it was

### A document older than the one above it is flagged as stale
<!-- touches: apps/vscode/src/features/spec-viewer/staleness.ts, apps/vscode/webview/src/spec-viewer/components/StaleBanner.tsx -->

A workflow document SHALL show a stale banner, and a mark on its rail entry, when any document earlier in the workflow was modified after it. The banner names the newer document and offers Regenerate. It is a warning only: the document stays readable and every other action stays available. A completed or archived spec SHALL show no staleness.

#### Scenario: the spec is edited after planning
- **WHEN** spec.md is saved after plan.md was last written
- **THEN** the Plan shows a banner saying it was generated before the current spec, with a Regenerate action

#### Scenario: a finished spec
- **WHEN** the same file times occur on a completed spec
- **THEN** no banner and no stale mark appear
