# Find a Living Spec — Living Spec

## Purpose

A living spec is only useful if a person can reach it from wherever they are: the sidebar, the file they are editing, or the run that touched it. This capability covers the Living Specs view, the status bar indicator, the Open Living Spec picker, and the links a feature spec's overview carries. Without it the specs exist on disk and nobody knows which one describes the code in front of them, or which ones have fallen behind.

## Requirements

### The view walks a new project from nothing to a first capability
<!-- touches: package.json, apps/vscode/src/features/living-specs/livingSpecsExplorerProvider.ts, apps/vscode/src/features/living-specs/livingSpecsModel.ts -->

The Living Specs view SHALL appear only when the Companion spec-kit extension is installed in the project. While it has nothing to list it SHALL offer the single next step as a button: install Companion, then Set Up Living Specs when there is no `living-specs.yml`, then Adopt Code Area when the registry is on and empty. A registry with `enabled` unset shows one "Living Specs are off" row that says what to set, and a registry that will not parse shows "Can't read living-specs.yml" with the parser's error instead of an empty or "off" state.

#### Scenario: a project with no registry
- **WHEN** Companion is installed and the project has no `living-specs.yml`
- **THEN** the view shows no rows, only the Set Up Living Specs button

#### Scenario: the registry is broken
- **WHEN** `living-specs.yml` cannot be parsed
- **THEN** the view shows one error row carrying the reason, and lists no capabilities from any older config

### Capabilities are listed as a tree that mirrors where their specs live
<!-- touches: apps/vscode/src/features/living-specs/livingSpecsExplorerProvider.ts, apps/vscode/src/features/living-specs/livingSpecsModel.ts -->

The view SHALL group capabilities by the folder their spec sits in, so a colocated spec appears under its source directories and central specs appear under the capabilities folder. A folder that holds only one spec is dropped and the capability stands in for it. Spec files that no capability claims are listed under an Orphans group, which is omitted when there are none. A subdirectory with its own registry is a separate project and nothing inside it is listed.

#### Scenario: two specs share a folder
- **WHEN** two capabilities keep their specs under `src/features`
- **THEN** both appear as rows under one collapsed `src/features` folder

#### Scenario: an unclaimed spec file
- **WHEN** a `*.spec.md` file exists outside the feature specs folder and no capability names it
- **THEN** it appears under Orphans and opens like any other spec

### A row says how healthy its capability is
<!-- touches: apps/vscode/src/features/living-specs/livingSpecsExplorerProvider.ts, apps/vscode/src/features/living-specs/livingSpecsModel.ts -->

Each capability row SHALL show, when known, how many requirements have a mapped test (`N/M covered`), the word `drift` with a warning icon when its code has moved past the spec, and `not created` when the registered spec file does not exist. A value that cannot be computed is left off the row, never shown as zero or as "in sync". `no coverage file` appears only once some capability in the project has a coverage file. A folder containing drifted capabilities opens itself and shows how many drifted, and the row tooltip leads with the spec's purpose.

#### Scenario: git cannot answer in time
- **WHEN** the drift lookup times out or the project is not a git repository
- **THEN** the row renders without a drift mark and the tree does not stall

#### Scenario: drift inside a collapsed folder
- **WHEN** one capability under a folder has drifted
- **THEN** the folder renders expanded with `1 drifted` beside its name

### Drift counts only changes nobody accounted for
<!-- touches: apps/vscode/src/features/living-specs/livingSpecsModel.ts -->

A capability is drifted when a file it claims changed in committed history since its spec was last committed. The count SHALL leave out exempt files (config, test and migration patterns), the spec and its sibling files, files changed by a completed run that recorded this capability as synced or skipped, and files that a requirement in another capability names while none here does. A spec that was never committed has no drift state at all.

#### Scenario: a run folded its change back
- **WHEN** a feature run changed a claimed file and its record lists this capability as synced
- **THEN** that file does not count as drift

#### Scenario: a hand edit with no run behind it
- **WHEN** a claimed source file is committed after the spec's last commit and no run vouches for it
- **THEN** the capability shows drift

### Opening a row opens the spec in the living-spec viewer
<!-- touches: apps/vscode/src/features/living-specs/livingSpecsExplorerProvider.ts, apps/vscode/src/features/living-specs/livingSpecsCommands.ts -->

Clicking a capability SHALL open its spec in the viewer in living-spec mode, including when the spec file does not exist yet. A capability with a rules or coverage file expands to Spec, Rules and Coverage children that each open their own file, and a capability with only a spec has no children. Rows also offer Copy Name, Copy Path, Copy Relative Path and Delete. Delete asks for confirmation naming the file, removes that one file, and refuses any path outside the workspace.

#### Scenario: a capability with only a spec
- **WHEN** a capability has no rules or coverage file
- **THEN** its row has no disclosure triangle and clicking it opens the spec

#### Scenario: deleting a spec
- **WHEN** someone picks Delete on a row and confirms
- **THEN** the file is deleted, the tree refreshes, and the registry entry is left as it was

### A spec is reachable from the file being edited, or by name
<!-- touches: apps/vscode/src/features/living-specs/livingSpecsStatusBar.ts, apps/vscode/src/features/living-specs/livingSpecsCommands.ts, apps/vscode/src/features/living-specs/livingSpecsModel.ts -->

While the active editor holds a file that at least one capability claims, the status bar SHALL show `N living spec(s)`, and clicking it (or running Living Specs for This File) lists the requirements that describe that file, grouped by capability, most specific capability first. Picking one opens the spec at that requirement. The indicator is hidden when nothing claims the file. A requirement with no `touches` marker is always listed, so a missing marker costs an extra row rather than hiding a rule. Open Living Spec does the same by name: it asks which capability, then offers its requirement headings plus "Open at the top".

#### Scenario: an unclaimed file
- **WHEN** the active file matches no capability
- **THEN** no living-specs indicator is shown

#### Scenario: a claimed capability has no spec on disk
- **WHEN** a capability claims the file and its spec file is missing
- **THEN** the picker shows a warning line under that capability instead of requirements

### A feature spec links to the living specs its run read and updated
<!-- touches: apps/vscode/src/features/living-specs/livingSpecsContent.ts, apps/vscode/webview/src/spec-viewer/components/cards/LivingSpecsCard.tsx, apps/vscode/webview/src/spec-viewer/components/OverviewDossier.tsx -->

When a run's record names living specs, the feature spec's overview SHALL list them as links in two groups, "Updated by this run" and "Read for context", under readable names. A link opens that capability in the living-spec viewer. A capability that cannot be found shows a "Living spec not found" warning instead of opening anything. The section is absent when the run named none.

#### Scenario: a run that synced one capability and read another
- **WHEN** the record lists one capability as synced and another only as loaded
- **THEN** each appears once, under its own group, as a clickable link

### The view keeps itself current
<!-- touches: apps/vscode/src/extension.ts, apps/vscode/src/features/living-specs/livingSpecsExplorerProvider.ts -->

The tree SHALL refresh when the registry, the older Companion config, the capabilities folder or any `*.spec.md` file is created, changed or deleted, and on Refresh Living Specs. An open living-spec panel re-renders when its file changes on disk. When an older `livingSpecs` block still exists beside a `living-specs.yml`, the view shows a notice that the old entries are ignored.

#### Scenario: the assistant finishes adopting
- **WHEN** an adopt run writes a new spec and appends to the registry
- **THEN** the new capability appears in the tree without a manual refresh

## Uncovered

- The exact list of exempt patterns the view uses for drift is fixed in the extension and does not read the registry's own `exempt` key. Whether that is intended was not determined.
