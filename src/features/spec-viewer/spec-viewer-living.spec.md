# Spec Viewer Living — Living Spec

<!-- reviewed: 763a4a8b -->

> [DRAFT] Surface-first draft from existing code. Every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

Living mode presents a capability rather than a run: its tiers, verified coverage, health facts, and the run-log chips that hand off to it.

## Requirements

### A living spec is presented as a capability, not a run

A living-spec panel MUST drop run state, phases, and the workflow forward action, and MUST NOT offer an Overview or tier strip: opening a capability lands on its requirement cards. Its title comes from the capability's spec document for every tier. The header states each fact once: a DRAFT badge when the document is a draft, requirement counts by state, coverage, what the capability covers, and where its file lives. The shared footer bar states the capability's condition and offers adopt another area and validate living specs always, and sync this spec only once drift is found, each resolving the spec tier from the panel's source anchor and handing off to the shared living-specs commands. A covers glob is a control that reveals that place in the Explorer.

A tier SHALL resolve by the resolver's naming convention, and a renamed convention SHALL still resolve a project's existing file.

#### Scenario: a capability is opened from the tree
- **WHEN** the panel renders
- **THEN** it shows the requirement cards, with no Overview and no tab strip

#### Scenario: the project predates the rules tier's rename
- **WHEN** the capability's rules file still carries the old suffix
- **THEN** it is listed as the rules tier, not reported missing

#### Scenario: the reader asks to update a drifted living spec
- **WHEN** the reader triggers the update from the footer bar
- **THEN** the spec-tier path is resolved from the panel's source anchor and routed through the living-specs update command the sidebar uses

#### Scenario: a covers glob is activated
- **WHEN** the reader clicks it
- **THEN** the glob's static prefix is confined to the workspace and revealed in the Explorer; a prefix that is not a real path falls back to a find-in-files scoped to the glob

### Approving an adopted requirement only ever removes what adoption claimed

Approving SHALL delete the `adopted` marker, for one requirement by heading or for every requirement in the tier on screen, and change nothing else. When the last marker goes, the `[DRAFT]` banner SHALL go with it, and approving the whole spec SHALL remove the banner even when no marker was left to remove. A request that would write outside the workspace or to a non-tier file MUST be refused and logged, and one that changes neither a marker nor the banner MUST leave the file untouched.

#### Scenario: the last adopted requirement in a tier is approved
- **WHEN** the reader approves it
- **THEN** that requirement's marker is removed along with the document's draft banner
- **AND** the panel re-renders without the DRAFT badge

#### Scenario: approval is asked for a document that is not a living tier
- **WHEN** the request names a file outside the workspace root, or one that is not a tier file
- **THEN** nothing is written and the refusal is logged

#### Scenario: a draft with no adopted markers is approved whole
- **WHEN** the reader approves the spec
- **THEN** the draft banner is removed from the file

### Living specs surfaced in the run log are compact chips that hand off to their own viewer

Living specs a run loaded MUST appear in the run log as compact clickable chips, never with purpose and requirements inline. A capability is clickable only when its spec resolves to an existing file inside the workspace root; otherwise it stays listed but unavailable, and any unexpected failure leaves the names-only list untouched. Clicking a chip MUST open the capability in living mode, confining the supplied path to the root before any filesystem access.

#### Scenario: a loaded capability resolves within the workspace
- **WHEN** the run log lists a living spec whose document exists inside the workspace
- **THEN** it renders as a chip carrying that capability's workspace-relative path
- **AND** clicking it opens the capability in the living-spec viewer instead of expanding content in place

#### Scenario: a capability cannot be resolved
- **WHEN** a loaded living spec has no resolvable in-root document
- **THEN** it is still listed but not clickable
- **AND** the run log never renders the capability's purpose or requirement rows inline

### Displayed coverage is verified, and an empty result is stated rather than hidden

A test a requirement names SHALL be confirmed to exist before the table presents it as coverage. A named test that cannot be found SHALL render in a state distinct from both a confirmed test and an unmapped requirement, and that distinction MUST survive without colour. Where several tests are named, the label SHALL say how many were found.

Coverage SHALL render even when nothing is traced, because the header already reports the zero and the section explains it.

#### Scenario: a requirement names a test that is not on disk
- **WHEN** a linked test path does not resolve in the workspace
- **THEN** that row renders in its own state and the label says how many of the named tests were found

#### Scenario: no requirement has a linked test
- **WHEN** coverage rows exist and none is traced
- **THEN** the section renders, states the zero, and lists the untraced requirements

### Best-effort facts are omitted, never rendered as zeros

Any fact the viewer cannot determine (a count, date, coverage ratio, or drift verdict) MUST be omitted, not shown as empty or zero.

#### Scenario: a capability's health cannot be computed
- **WHEN** the repository has no version control, or the check times out
- **THEN** the coverage and drift facts are absent from the header
- **AND** nothing renders as `0`

### Slow facts arrive after first paint and are discarded if the panel moved on

A slow fact MUST NOT block the panel's first render; it SHALL be resolved afterwards and pushed. The push MUST be dropped if the panel has since been re-anchored to a different subject.

#### Scenario: two capabilities share a panel
- **WHEN** the reader switches to a second capability while the first one's health check is still running
- **THEN** the late result is discarded
- **AND** the header shows only facts about what is on screen

## Uncovered

_None: every file in the area was read, though test files under `__tests__/` were read only for the contracts they pin._

### An open living spec follows its file and names what drifted

An open living-spec panel SHALL redraw when its spec file is changed or created on disk, wherever the capability lives. Once drift resolves, the panel SHALL receive the drifted requirements: those whose touches marker matches a drifted file, from the same drift result the sidebar uses. A requirement with no touches marker never drifts, and when drift cannot be computed the list is absent, not empty.

#### Scenario: adoption writes the spec an empty panel was showing
- **WHEN** the file appears on disk
- **THEN** the open panel redraws with its cards

#### Scenario: a drifted file matches one requirement's marker
- **WHEN** health resolves
- **THEN** only that requirement is named as drifted

### A requirement can be removed from the viewer, unless something still leans on it

The viewer SHALL offer Remove on every requirement card, deleting that requirement up to the next heading after the reader confirms. When a requirement in another capability aligns to it, removal SHALL be refused with a message naming those capabilities. A link from the requirement's own capability, including a self-link, SHALL NOT block it. A removal that outlives its Undo window SHALL append one `requirement-removed` record naming the capability and the heading to the `.spec-context.json` beside the spec, creating the file when absent.

#### Scenario: nothing in another capability aligns to the requirement
- **WHEN** the reader confirms Remove
- **THEN** the requirement and its scenarios are gone from the file and the panel redraws

#### Scenario: another capability aligns to it
- **WHEN** the reader picks Remove
- **THEN** nothing is written and the message names the capability that leans on it

#### Scenario: a removal stands past its Undo window
- **WHEN** the window runs out, a newer action replaces it, or the panel closes
- **THEN** one removal record is appended beside the spec

### Approve all and Remove can be undone for five seconds

The panel SHALL hold one pending undo in the extension, carrying the file text before and after the write, because every write regenerates the webview page. The webview SHALL receive a token and an expiry only while the window is open. Undo SHALL restore the earlier text byte for byte when the file still reads as the action left it, and otherwise SHALL write nothing and tell the reader the file changed. An undone removal SHALL leave no record, and a stale token SHALL be ignored.

#### Scenario: Undo right after Approve all
- **WHEN** the reader presses Undo within 5 seconds
- **THEN** the file is byte-identical to before the approval

#### Scenario: the file changed during the window
- **WHEN** the reader presses Undo
- **THEN** nothing is written and a warning says the file changed

### Requirements added on the branch are marked new without writing the spec

After first paint the extension SHALL compare the spec's headings with `git show main:<path>` and push the headings `main` lacks as `newRequirements`. A body-only change SHALL NOT count as new. When `main`'s copy cannot be read for any reason, `newRequirements` SHALL be absent. The spec file SHALL never be written.

#### Scenario: a branch added one requirement
- **WHEN** the health push resolves
- **THEN** `newRequirements` names only that heading

#### Scenario: the repository has no `main`
- **WHEN** the health push resolves
- **THEN** `newRequirements` is absent

### Each requirement card says how many of its tests exist

The extension SHALL send, with the capability's other health facts after first paint, a coverage label per requirement, and the card SHALL show it beside the state pill. The label counts the test files the requirement's coverage line names and says how many exist when some do not. A requirement whose line names no test SHALL have no label, never a zero. The cards SHALL redraw only when the labels changed, and labels SHALL NOT survive onto another capability's cards.

#### Scenario: a requirement's coverage line names a test that exists
- **WHEN** the capability's health resolves
- **THEN** that requirement's card shows its label

#### Scenario: another capability opens and resolves no health facts
- **WHEN** its cards render
- **THEN** none of them carries the previous capability's label
