# Spec Viewer Living — Living Spec

<!-- reviewed: 763a4a8b -->

> [DRAFT] Surface-first draft from existing code — every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

Living mode presents a capability rather than a run: its tiers, its verified coverage, its health facts, and the chips a run log uses to hand off to it. Without it the viewer would dress a living spec in workflow machinery it does not have and show unverified coverage with the authority of a check.

## Requirements

### A living spec is presented as a capability, not a run

A living-spec panel MUST drop the workflow machinery entirely — no run state, no phases, no workflow forward action — and MUST NOT offer an Overview or a tier strip: opening a capability lands on its requirement cards, and the rules and coverage files open from the Living Specs tree. Its title comes from the capability's own spec document whichever tier is displayed. The header carries facts only: a DRAFT badge when the document declares itself a draft, the requirement counts by state, coverage, what the capability covers and where its file lives — stated once each. Its actions sit in the same footer bar every other viewer state uses, beside a line stating the capability's condition: adopting another area and validating living specs are offered whatever the capability's state, and syncing this spec to its code only once drift has been found. Each resolves the capability's spec tier from the panel's own source anchor and hands off to the shared living-specs commands. A covers glob is a control that reveals that place in the Explorer.

A tier is resolved by the naming convention the resolver writes, and a convention that has been renamed SHALL still resolve the file a project already has.

#### Scenario: a capability is opened from the tree
- **WHEN** the panel renders
- **THEN** it shows the requirement cards, with no Overview and no tab strip

#### Scenario: the project predates the rules tier's rename
- **WHEN** the capability's rules file still carries the old suffix
- **THEN** it is listed as the rules tier rather than reported missing

#### Scenario: the reader asks to update a drifted living spec
- **WHEN** the reader triggers the update from the footer bar
- **THEN** the capability's spec-tier path is resolved from the panel's source anchor and routed through the same living-specs update command the sidebar uses

#### Scenario: a covers glob is activated
- **WHEN** the reader clicks it
- **THEN** the glob's static prefix is confined to the workspace and revealed in the Explorer; a prefix that is not a real path falls back to a find-in-files scoped to the glob

### Approving an adopted requirement only ever removes what adoption claimed

An adopted requirement was transcribed from the code and nothing has checked it since, so approval is the reader saying they have. Approving SHALL delete the `adopted` marker — for one requirement by its heading, or for every requirement in the tier on screen — and change nothing else in the document, since the reader is confirming the text, not editing it. When the last marker in the file goes, the `[DRAFT]` banner goes with it, because a document with nothing left unconfirmed is no longer a draft. A request that would write outside the workspace, or to a file that is not a living tier, MUST be refused and logged, and a request that finds nothing to remove MUST leave the file untouched rather than rewrite it identically.

#### Scenario: the last adopted requirement in a tier is approved
- **WHEN** the reader approves it
- **THEN** that requirement's marker is removed along with the document's draft banner
- **AND** the panel re-renders without the DRAFT badge

#### Scenario: approval is asked for a document that is not a living tier
- **WHEN** the request names a file outside the workspace root, or one that is not a tier file
- **THEN** nothing is written and the refusal is logged

### Living specs surfaced in the run log are compact chips that hand off to their own viewer

When a run loaded living specs, the viewer MUST surface them in the run log as compact, clickable chips rather than dumping each capability's purpose and requirements inline — the full content belongs in the Living Specs viewer, not the run strip. A capability earns a clickable chip only when its spec resolves to a file that exists within the workspace root; a capability that cannot be resolved or falls outside the root stays present but unavailable, and any unexpected failure leaves the names-only list untouched. Clicking a chip MUST open that capability in the viewer's living mode, confining the supplied path within the root before it reaches the filesystem.

#### Scenario: a loaded capability resolves within the workspace
- **WHEN** the run log lists a living spec whose document exists inside the workspace
- **THEN** it renders as a chip carrying that capability's workspace-relative path
- **AND** clicking it opens the capability in the living-spec viewer rather than expanding content in place

#### Scenario: a capability cannot be resolved
- **WHEN** a loaded living spec has no resolvable in-root document
- **THEN** it is still listed but is not made clickable
- **AND** the run log never renders the capability's purpose or requirement rows inline

### Displayed coverage is verified, and an empty result is stated rather than hidden

The requirement-to-test table renders with the visual authority of a check, so it MUST behave like one. A test a requirement names SHALL be confirmed to exist before the table presents it as coverage, and a named test that cannot be found SHALL render in a state distinct from both a confirmed test and a requirement that was never mapped — a link resolving to nothing is worse than an honest gap, because it reads as coverage that exists. Where several tests are named, the label SHALL say how many were found, so a partly-real link is not read as whole. The distinction MUST survive without colour.

Coverage is the one section exempt from hiding itself when empty. Nothing traced is a finding, not an absence, and the header strip reports the count whether the section renders or not — so hiding it left the page stating the zero and withholding the explanation at the same time.

#### Scenario: a requirement names a test that is not on disk
- **WHEN** a linked test path does not resolve in the workspace
- **THEN** that row renders in its own state and the label says how many of the named tests were found

#### Scenario: no requirement has a linked test
- **WHEN** coverage rows exist and none is traced
- **THEN** the section renders, states the zero, and lists the untraced requirements

### Best-effort facts are omitted, never rendered as zeros

Any fact the viewer cannot determine — a count, a date, a coverage ratio, a drift verdict — MUST be left out of the surface rather than shown as an empty or zero value. A zero the reader can trust and a fact nobody could compute are different claims, and rendering them identically makes the surface lie.

#### Scenario: a capability's health cannot be computed
- **WHEN** the repository has no version control, or the check times out
- **THEN** the coverage and drift facts are simply absent from the header
- **AND** nothing renders as `0`

### Slow facts arrive after first paint and are discarded if the panel moved on

A fact that costs real time to compute MUST NOT block the panel's first render. It SHALL be resolved afterwards and pushed to the panel, and the push MUST be dropped if the panel has since been re-anchored to a different subject — otherwise a slow answer about one capability lands on another.

#### Scenario: two capabilities share a panel
- **WHEN** the reader switches to a second capability while the first one's health check is still running
- **THEN** the late result is discarded
- **AND** the header keeps showing only facts belonging to what is on screen

## Uncovered

_None — every file in the area was read, though the test files under `__tests__/` were read only for the contracts they pin, not line by line._

### An open living spec follows its file and names what drifted

An open living-spec panel SHALL redraw when its capability's spec file is changed or created on disk, wherever the capability lives. Once drift resolves, the panel SHALL be told which requirements drifted: those whose touches marker matches a drifted file, computed from the same drift result the sidebar uses. A requirement with no touches marker never drifts, and when drift cannot be computed the list is absent rather than empty.

#### Scenario: adoption writes the spec an empty panel was showing
- **WHEN** the file appears on disk
- **THEN** the open panel redraws with its cards

#### Scenario: a drifted file matches one requirement's marker
- **WHEN** health resolves
- **THEN** only that requirement is named as drifted

### A requirement can be removed from the viewer, unless something still leans on it

The viewer SHALL offer Remove on every requirement card. Removing deletes that requirement, heading to the next, from the spec file after the reader confirms. When another capability's `aligns` marker names the requirement, the removal SHALL be refused and the message SHALL name those capabilities.

#### Scenario: nothing aligns to the requirement
- **WHEN** the reader confirms Remove
- **THEN** the requirement and its scenarios are gone from the file and the panel redraws

#### Scenario: another capability aligns to it
- **WHEN** the reader picks Remove
- **THEN** nothing is written and the message names the capability that leans on it
