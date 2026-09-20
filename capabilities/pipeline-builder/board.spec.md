# Pipeline Builder Board — Living Spec

## Purpose

What the Pipeline Builder webview draws: the run as steps, phases, nodes and hooks; the header's facts about the whole pipeline; and the one column that shows a node, a form or a broken-state recovery, never more than one at once.

## Requirements

### Only one thing ever occupies the side column
<!-- touches: apps/vscode/webview/src/pipeline-builder/index.tsx -->

The side column SHALL show at most one of a node, an attach-hook form, a template form, a new-step form, or a new-workflow form at a time; opening a second one SHALL close whichever was open.

#### Scenario: a node is open and the reader clicks Add hook elsewhere on the board
- **WHEN** the attach form opens
- **THEN** the node inspector closes, and only the attach form is shown

### The divergence chip names how much changed and goes to the first of it
<!-- touches: apps/vscode/webview/src/pipeline-builder/Header.tsx, apps/vscode/webview/src/pipeline-builder/changes.ts -->

The header SHALL show "No changes" as a flat chip when no step differs from the shipped pipeline, and otherwise a chip naming how many steps differ that scrolls the first differing step into view when clicked.

#### Scenario: two steps differ from the shipped pipeline
- **WHEN** the reader clicks the chip
- **THEN** the first of those two steps, in run order, comes into view

### The hook tally is counted from what the board actually draws
<!-- touches: apps/vscode/webview/src/pipeline-builder/Header.tsx, apps/vscode/webview/src/pipeline-builder/counts.ts -->

The header's hook count SHALL be totalled from the same steps, phases and nodes the canvas walks, never from a separately supplied count, so the header can never disagree with what the board shows. Running hooks, parked hooks and an installed extension's hooks SHALL be counted separately.

#### Scenario: the board draws five attached hooks
- **WHEN** the header's tally is read
- **THEN** it also reads five, never a number computed some other way

#### Scenario: every one of this project's hooks is parked because the shipped pipeline is active
- **WHEN** the header summarizes hooks
- **THEN** it says no hooks are running rather than that there are no hooks

### Running the shipped pipeline keeps every parked hook visible
<!-- touches: apps/vscode/webview/src/pipeline-builder/Header.tsx -->

While the shipped pipeline is active, the header SHALL state that this project's configuration is not running, name how many of its hooks are parked on the board, and separately name any that attach to something the shipped pipeline does not have and so cannot be drawn.

#### Scenario: a hook is anchored to a node the shipped pipeline does not include
- **WHEN** the shipped pipeline is active
- **THEN** the header counts it apart from the hooks that are simply parked, rather than silently dropping it

### A finished build or preview replaces the stale-build notice, not stacks beside it
<!-- touches: apps/vscode/webview/src/pipeline-builder/Header.tsx -->

Once a build or preview report exists, the header SHALL show that report in place of the generic "not built yet" notice, because the report already states the more specific fact the notice existed to say.

#### Scenario: a preview reports that two of five commands would change
- **WHEN** the header redraws
- **THEN** it shows that report alone, not also an amber "changed steps not built" line

### A broken pipeline offers its narrowest repair first, each naming its cost
<!-- touches: apps/vscode/webview/src/pipeline-builder/BrokenPipeline.tsx -->

When the panel cannot read the configuration, it SHALL list the available repairs narrowest first, each with a line saying what it costs, and SHALL always offer opening `companion.yml` by hand regardless of whether any repair is offered.

#### Scenario: the configuration is broken and no repair can be offered
- **WHEN** the broken-state screen renders
- **THEN** the manual "Open companion.yml" option is still shown

#### Scenario: more than one repair is offered
- **WHEN** the reader reads the list top to bottom
- **THEN** the least destructive repair appears first and the more destructive ones read as costing more

### The status line offers Undo only when the write it names can be undone
<!-- touches: apps/vscode/webview/src/pipeline-builder/StatusLine.tsx -->

The status line SHALL show an Undo control only when the status it is reporting carries an undo token, and SHALL always let the reader dismiss the line regardless of whether Undo is offered.

#### Scenario: the last write cannot be reversed
- **WHEN** the status line renders
- **THEN** it shows the status text and a dismiss control, with no Undo button

### A node with no instructions of its own still says what feeds it
<!-- touches: apps/vscode/webview/src/pipeline-builder/Inspector.tsx -->

Reading a node whose body is empty SHALL say it exists only to carry shared blocks, and SHALL still list which shared parts are stitched in at build time, rather than showing an empty pane.

#### Scenario: a node exists only to hold shared blocks
- **WHEN** its instructions are read
- **THEN** the pane says so and lists the parts stitched into it, instead of showing nothing

## Uncovered

_`Canvas.tsx` draws the graph's positions and connecting lines; its observable marks (`changed`, `gate`, `held`, `yours`, before/after blocks) are the vocabulary `docs/pipeline-builder.md` documents for readers and are exercised by `Board.test.tsx` and the visual baselines in `tooling/scripts/visual-builder.mjs`, rather than restated here to avoid describing layout as if it were behaviour. `SidePanel.tsx` is shared chrome with no behaviour beyond what its five callers already state above and in the editing spec._
