# Review a Living Spec — Living Spec

## Purpose

A living spec drafted by an assistant is a claim nobody has checked. This capability is the viewer in living-spec mode: it shows what a capability covers and how healthy it is, renders each requirement as a card that says whether it is confirmed, adopted, drifted or new, and lets a person approve, remove or comment on requirements. Without it, reviewing a spec means reading raw markdown and hand-deleting markers.

## Requirements

### A living spec opens as a capability, not as a run
<!-- touches: apps/vscode/src/features/spec-viewer/specViewerProvider.ts, apps/vscode/src/features/living-specs/livingDocs.ts, apps/vscode/webview/src/spec-viewer/App.tsx -->

In living-spec mode the viewer SHALL show no workflow steps, step rail, run strip or run overview: the page is the one file that was opened, and the rules and coverage files open from the sidebar. The panel is titled `Living Spec: <name>`, where the name is the spec's own top heading with any trailing "Living Spec" removed, falling back to the file stem or capability folder. The badge reads `DRAFT` while a `[DRAFT]` banner sits near the top of the spec and `LIVING` otherwise, and the banner line itself is not repeated in the body.

#### Scenario: a spec with a hand-written title
- **WHEN** the spec begins `# SpecKit Viewer — Living Spec`
- **THEN** the panel and header read "SpecKit Viewer", not a capitalized slug

#### Scenario: the word draft deep in the text
- **WHEN** a requirement far down the document mentions "[draft]" and the top carries no banner
- **THEN** the badge still reads `LIVING`

### The header states what the capability covers and how healthy it is
<!-- touches: apps/vscode/src/features/living-specs/livingHeaderMeta.ts, apps/vscode/webview/src/spec-viewer/components/SpecHeader.tsx -->

The header SHALL show the requirement and scenario counts, how many requirements are adopted and unconfirmed, how many are new on this branch, the `N/M covered` count, a drift fact, the path patterns the capability covers, and where the spec lives. A fact that is zero or cannot be computed is left out rather than shown as `0`. Coverage and drift SHALL match what the sidebar row shows for the same capability, and they arrive after the page renders so a slow git never delays the spec.

#### Scenario: no coverage file
- **WHEN** the capability has no coverage file beside its spec
- **THEN** the header shows no coverage count at all

#### Scenario: clicking a covered pattern
- **WHEN** someone clicks one of the Covers patterns
- **THEN** its folder is revealed in the Explorer, or a file search for the pattern opens when no such folder exists

### Each requirement is a card that carries its own state
<!-- touches: apps/vscode/webview/src/spec-viewer/markdown/livingComponents.ts, apps/vscode/webview/src/spec-viewer/toc.ts -->

Every `###` requirement under `## Requirements` SHALL render as a card, in authored order, with the purpose shown first as a callout and WHEN separated from THEN in each scenario. A card is marked Drifted when a file its `touches` marker names has drifted, otherwise Adopted while it carries an `adopted` marker, and additionally New when main's copy of the spec lacks that heading, `inferred` when tagged so, and with a test count when the coverage file names tests for it. The `touches`, `adopted` and `aligns` markers never appear as prose. The "On this page" outline lists the same requirements with the same marks.

#### Scenario: an example heading inside a code fence
- **WHEN** a `###` line sits inside a fenced block
- **THEN** it gets no card and is not counted as a requirement anywhere

#### Scenario: a requirement added after the uncovered section
- **WHEN** a requirement was appended below `## Uncovered`
- **THEN** it still renders as a card

### A card links to the files and the requirements it depends on
<!-- touches: apps/vscode/webview/src/spec-viewer/markdown/livingComponents.ts, apps/vscode/src/features/living-specs/livingSpecsModel.ts, apps/vscode/src/features/spec-viewer/messageHandlers.ts -->

A card SHALL list the path patterns its `touches` marker names, each revealing that location, and the source an adopted requirement was transcribed from. Requirements joined by an `aligns` marker show as "Leans on" on one card and "Leaned on by" on the other, and clicking one opens the other capability at that requirement. A link that matches no capability or heading is shown as broken and opens nothing.

#### Scenario: an aligns marker with a misspelled heading
- **WHEN** a card's `aligns` marker names a heading that does not exist
- **THEN** the link renders as broken, keeps its original text, and is not clickable

### Approving only removes the unreviewed marks
<!-- touches: apps/vscode/src/features/living-specs/livingDocs.ts, apps/vscode/src/features/spec-viewer/messageHandlers.ts, apps/vscode/webview/src/spec-viewer/components/footer/LivingFooter.tsx -->

Approve on an adopted card SHALL delete that requirement's `adopted` marker and change nothing else in the file. "Approve all N" does this for every requirement and removes the `[DRAFT]` banner, and a draft with nothing adopted offers "Approve spec" to clear the banner alone. Approving the last adopted requirement one at a time also clears the banner. Approval only ever writes to a spec or rules file inside the workspace.

#### Scenario: the last adopted card is approved
- **WHEN** one adopted requirement remains and someone approves it
- **THEN** its marker and the `[DRAFT]` banner are both removed and the badge turns `LIVING`

### Removing a requirement is confirmed, guarded and recorded
<!-- touches: apps/vscode/src/features/spec-viewer/messageHandlers.ts, apps/vscode/src/features/living-specs/livingDocs.ts -->

Remove on a card SHALL ask for confirmation, then delete the requirement and its scenarios from the spec file. It is refused, with the names of the capabilities involved, while another capability's requirement still aligns to it. A removal that stands is recorded as a user removal in the `.spec-context.json` beside the spec, which is the only thing living-spec mode ever writes there.

#### Scenario: another capability leans on the requirement
- **WHEN** someone removes a requirement that a second capability aligns to
- **THEN** nothing is deleted and a warning names the second capability

### Approve all and Remove can be undone for five seconds
<!-- touches: apps/vscode/src/features/spec-viewer/specViewerProvider.ts, apps/vscode/src/features/spec-viewer/messageHandlers.ts, apps/vscode/webview/src/spec-viewer/components/footer/LivingFooter.tsx -->

After Approve all or Remove the viewer SHALL offer one Undo for five seconds that puts the file back exactly as it was. Undo is refused with a warning when the file changed in the meantime, because restoring would overwrite that change. Only one undo is held per panel, and a newer action, another capability opening in the panel, or the panel closing settles the older one.

#### Scenario: the assistant edits the file during the countdown
- **WHEN** the spec changes on disk after a removal and someone presses Undo
- **THEN** the file is left alone, a warning explains why, and the removal is recorded as standing

### Comments on a living spec are sent, not saved
<!-- touches: apps/vscode/src/features/spec-viewer/messageHandlers.ts, apps/vscode/webview/src/spec-viewer/editor/refinements.ts -->

Inline comments SHALL work on a living spec as they do on a feature spec, except that they live only in the open panel. Refine sends them to the assistant as an in-place edit request aimed at the file on screen, and never runs a workflow step.

#### Scenario: refining the rules file
- **WHEN** someone comments on two lines of a capability's rules file and presses Refine
- **THEN** the assistant receives both comments with their quoted lines and the rules file's path as the file to edit

## Uncovered

- The spec viewer anatomy page on the website still describes a tab strip (Overview, Spec, Rules, Coverage) and a landing Overview for a living spec. The viewer has neither. The page is stale, not the code.
- How the reason-grouped `## Uncovered` section renders (count, scope line, collapsed groups) was seen and not specified.
