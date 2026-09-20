# Pipeline Builder Panel — Living Spec

## Purpose

The extension-side host for the Pipeline Builder: one panel showing the project's `.specify/companion.yml` as a graph, every write it can make to that file, and how a node's raw source becomes the text a person edits.

## Requirements

### One builder panel is ever open, revealed rather than duplicated
<!-- touches: apps/vscode/src/features/pipeline-builder/builderPanel.ts -->

Opening the builder while one is already open SHALL reveal and refresh the existing panel instead of creating a second one.

#### Scenario: the open command runs twice
- **WHEN** the second invocation happens with a panel already open
- **THEN** that panel comes to the front and redraws, and no second panel exists

### The panel redraws when the configuration changes on disk, from any source
<!-- touches: apps/vscode/src/features/pipeline-builder/builderPanel.ts -->

A change to `.specify/companion.yml`, a node, a workflow, a fragment, or a template SHALL make the open panel resend its graph, whether that change came from the panel itself, another editor, or a build.

#### Scenario: `companion.yml` is edited in another editor while the panel is open
- **WHEN** the file is saved
- **THEN** the panel's graph updates without the reader touching the panel

### Editing a node's instructions is the only way its copy is made
<!-- touches: apps/vscode/src/features/pipeline-builder/builderPanel.ts -->

Saving an edited node SHALL write the project's own copy under `.specify/companion/nodes/`, carrying over the shipped node's frontmatter, and SHALL leave the shipped source untouched. There is no separate action that forks a node without editing it.

#### Scenario: a node is edited and saved for the first time
- **WHEN** the write completes
- **THEN** the project's copy exists, the shipped file is unchanged, and the node is marked as the project's own

### A refused write leaves disk and panel agreeing with each other
<!-- touches: apps/vscode/src/features/pipeline-builder/builderPanel.ts -->

When a write to `companion.yml` fails validation, the file on disk SHALL be left exactly as it was, and the panel SHALL redraw from that unchanged file rather than keep showing the refused edit.

#### Scenario: an edit that would produce an invalid configuration is submitted
- **WHEN** the write is refused
- **THEN** the panel's drawing reverts to match the file, showing no trace of the refused change

### Only the most recent undoable write can be undone
<!-- touches: apps/vscode/src/features/pipeline-builder/builderPanel.ts -->

A write that can be reversed SHALL offer Undo on the status line, and a further write before Undo is used SHALL replace that offer rather than queue behind it, so an Undo can never land on top of a change that came after it.

#### Scenario: a node is restored to shipped, then a second write happens before Undo is clicked
- **WHEN** the reader then presses the status line's Undo
- **THEN** it reverses only the second write, and the first restoration is never reachable through it

### A node the project invented cannot be given back to a shipped source that does not exist
<!-- touches: apps/vscode/src/features/pipeline-builder/builderPanel.ts -->

Asking to restore a node to its shipped version SHALL be refused, with a message saying why, when that node has no shipped counterpart.

#### Scenario: "use the shipped node" is invoked on a step the project added
- **WHEN** the panel handles the request
- **THEN** it refuses and explains, and the project's only copy of the node is not deleted

### Replacing a step with one document seeds it from what the step already runs
<!-- touches: apps/vscode/src/features/pipeline-builder/builderPanel.ts -->

Choosing to replace a whole step with a single document SHALL seed the new node from that step's current frame and every node's body combined, open it for editing, and SHALL delete the seeded file again if the write that follows is refused.

#### Scenario: the write that follows seeding is refused
- **WHEN** validation rejects it
- **THEN** the seeded file is removed, leaving no orphaned node behind

### Build and Preview run the one path the command palette runs, and report in the panel
<!-- touches: apps/vscode/src/features/pipeline-builder/builderPanel.ts -->

Preview and Build SHALL invoke the same build command available from the command palette, show the panel as busy while it runs, and post the finished report into the panel itself. A build's reported timestamp SHALL never persist past the redraw it belongs to.

#### Scenario: a build finishes
- **WHEN** the panel redraws afterward
- **THEN** the report appears in the panel, not as a separate notification, and the graph reflects the new build state

#### Scenario: the panel redraws again later, for an unrelated reason
- **WHEN** no new build has run since
- **THEN** the previous build's timestamp is not shown as if it just happened

### Opening a node's file falls back through project, extension, then bundled copies
<!-- touches: apps/vscode/src/features/pipeline-builder/builderPanel.ts -->

Opening a node's source SHALL look for the project's own copy first, then the installed spec-kit extension's copy, then this extension's bundled copy, and SHALL fall back to the rendered command file, or an informational message, when none of those exist.

#### Scenario: a node exists only in the bundled default set
- **WHEN** the reader opens its file
- **THEN** the bundled copy opens, with no project or extension copy found first

### A node's raw source renders without its machinery
<!-- touches: apps/vscode/src/features/pipeline-builder/readableNode.ts -->

Converting a node's raw markdown to what the panel shows SHALL strip its frontmatter and collapse its `speckit-companion:` part/node/phase/hook fences into a named list, while the text offered back for editing SHALL keep those fences intact so a save can re-attach them.

#### Scenario: a node file is only frontmatter with no body text
- **WHEN** it is converted for display
- **THEN** the rendered body is empty but its named parts are still listed

#### Scenario: a fenced code block sits inside the node's body
- **WHEN** blank lines around it are collapsed
- **THEN** the code block's own content is left untouched

## Uncovered

_None: `builderPanel.ts` and `readableNode.ts` were read in full, along with `readableNode.test.ts` for the contracts it pins._
