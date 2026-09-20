# Read the Pipeline — Living Spec

## Purpose

A person opens the Pipeline Builder to see the workflow their assistant actually runs, what the project changed in it, and what any one node says. Without it the only way to answer those questions is to read the configuration file and a dozen node files by hand.

## Requirements

### The panel opens on the workflow the project runs now
<!-- touches: apps/vscode/src/features/pipeline-builder/**, apps/vscode/src/features/specs/pipelineGraph.ts -->

**SpecKit Companion: Open Pipeline Builder** SHALL open one panel per window showing the workflow resolved from the project's configuration, and a project that changed nothing SHALL see exactly what ships. Opening it again SHALL reveal and refresh the panel that is already there. The panel reads the workflow from the installed Companion spec-kit extension and SHALL say so in place of the board when that extension is missing.

#### Scenario: no folder is open
- **WHEN** the command runs with no workspace folder
- **THEN** a warning asks for one and no panel opens

#### Scenario: the spec-kit extension is not installed
- **WHEN** the panel opens in a project without the Companion spec-kit extension
- **THEN** it says the builder needs that extension instead of drawing a board

### The run reads left to right as steps, phases and nodes
<!-- touches: apps/vscode/webview/src/pipeline-builder/** -->

The board SHALL draw every step that takes a turn in the run as a numbered column in run order, each holding its phases and each phase its nodes. A step that does not take a turn, such as `auto` or a project step with no `after:`, SHALL sit under **Outside the run** at the end. Each step header SHALL say how many nodes it runs and how many files it produces, each node card SHALL carry its name, kind, the files it writes, `gate` when it can stop the run and `held` when it cannot be reordered, and a step that routes on a verdict SHALL list each verdict with the steps it skips.

#### Scenario: a project step launched by hand
- **WHEN** a project step declares no step to run behind
- **THEN** it is drawn under Outside the run and not among the numbered columns

### Everything the project changed carries one mark
<!-- touches: apps/vscode/webview/src/pipeline-builder/** -->

A step that differs from the shipped workflow SHALL carry a `changed` mark that opens onto how it differs, a node the project rewrote SHALL read `yours`, and a document shape with swapped sections SHALL count them. Nothing the project left alone SHALL carry that mark. The header chip SHALL read `No changes` or the number of steps that differ, and clicking it SHALL scroll the first changed step into view.

#### Scenario: nothing was changed
- **WHEN** every step is as shipped
- **THEN** the chip reads `No changes` and no step, node or template chip is marked

### The header tally is counted from the board
<!-- touches: apps/vscode/webview/src/pipeline-builder/counts.ts, apps/vscode/webview/src/pipeline-builder/Header.tsx -->

The hooks chip SHALL open onto how many steps, phases and nodes the workflow holds, how many hooks are the project's own, how many an installed extension registered, and how many are parked. Each number SHALL be counted from what the board draws, so the tally and the board cannot disagree, and a parked hook SHALL never be counted as one that runs.

#### Scenario: no hooks anywhere
- **WHEN** the workflow holds no hooks
- **THEN** the chip says so plainly instead of showing a zero count

### Hooks at one anchor read top to bottom in the order they run
<!-- touches: apps/vscode/webview/src/pipeline-builder/Canvas.tsx -->

Everything attached to one node, phase or step SHALL sit in one block per side, `before` above the anchor and `after` below it, grouped by whoever registered it. The project's own hooks SHALL be headed by the file they are written in, `companion.yml` or the named workflow's file. Hooks an installed extension registered SHALL be drawn in the same block under `via <extension>`, ahead of the project's under `before` and behind them under `after`, readable but not editable, with `asks first` on one that prompts before running.

#### Scenario: two extensions alternate at one anchor
- **WHEN** the registry declares hooks from two extensions interleaved
- **THEN** the rows keep the declared order and a source's heading repeats where it resumes

### A node is read in the panel as the assistant reads it
<!-- touches: apps/vscode/src/features/pipeline-builder/readableNode.ts, apps/vscode/webview/src/pipeline-builder/Inspector.tsx -->

Clicking a node SHALL open a side panel with its instructions rendered, without frontmatter or empty build markers and with shared blocks named instead of shown blank, and beside them the node's kind, the files it writes including those it writes only sometimes, the nodes it needs, whether it can move or what holds it, and whether it ships with Companion or is the project's. Clicking a step's name SHALL open that step's preamble the same way, and **Open the file** SHALL open the source in the editor. While the instructions are still loading the panel SHALL say so and SHALL NOT offer **Edit**, so nobody opens an empty draft and saves it over a shipped node.

#### Scenario: a node that cannot be reordered
- **WHEN** a held node is opened
- **THEN** the Order row gives the reason it is held and offers no move buttons

### Every menu in the panel behaves the same from the keyboard
<!-- touches: apps/vscode/webview/src/pipeline-builder/Menu.tsx -->

A menu opened from the keyboard SHALL put the keyboard on its first row that can be chosen, and SHALL leave it on the trigger when no row can be. The arrow keys SHALL step through the rows, Home and End SHALL jump to its ends, Escape SHALL close it and give the keyboard back to the trigger, and clicking away SHALL close it. This SHALL hold for every menu the panel draws, not only the workflow switcher.

#### Scenario: a menu where nothing can be chosen
- **WHEN** it is opened from the keyboard with every row unavailable
- **THEN** the keyboard stays on the trigger and no row is shown as chosen

#### Scenario: walking past the last row
- **WHEN** the down arrow is pressed on the last row
- **THEN** the keyboard returns to the first row

### The board follows the files
<!-- touches: apps/vscode/src/features/pipeline-builder/builderPanel.ts -->

The board SHALL redraw when `.specify/companion.yml`, a named workflow, a project node, a fragment or a template changes on disk, whoever changed it. An open node SHALL keep showing the same node after a redraw.

#### Scenario: the configuration is edited by hand
- **WHEN** someone saves `companion.yml` in the editor while the panel is open
- **THEN** the board shows the new workflow without being reopened

### A configuration the panel cannot read offers ways out
<!-- touches: apps/vscode/webview/src/pipeline-builder/BrokenPipeline.tsx, apps/vscode/src/features/pipeline-builder/builderPanel.ts, apps/vscode/src/features/specs/pipelineGraph.ts -->

When the configuration cannot be resolved the panel SHALL name the problem, say that nothing was changed and nothing runs from it, and offer each diagnosed repair as a button with what it costs, narrowest first and the broadest marked destructive. **Open companion.yml** SHALL always be offered, and a repair that is refused SHALL say why where it was pressed.

#### Scenario: too broken to diagnose
- **WHEN** the error arrives with no repairs
- **THEN** only the problem and the way to open the file are shown

## Uncovered

- How the workflow is resolved from `companion.yml`, and what a repair does to the file, belong to the spec-kit extension's scripts, not to this area.
- The sidebar icon that opens the panel, and when it appears, belongs to the sidebar.
