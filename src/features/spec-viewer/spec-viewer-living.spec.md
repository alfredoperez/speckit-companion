# Spec Viewer Living Mode — Living Spec

> Adopted from existing code on 2026-07-19. Requirements describe observed behavior and have not been individually verified against tests.

## Purpose

The viewer's capability-facing mode: a living spec presented as tiers rather than a run, best-effort header facts omitted rather than zeroed, slow facts arriving after first paint, and living specs surfaced as chips in the run log.

## Requirements
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

### A living spec is presented as a capability, not a run

A living-spec panel MUST drop the workflow machinery entirely — no run state, no phases, no workflow forward action — and present the capability's tiers as the only navigation. Its title comes from the capability's own spec document whichever tier is displayed, so the title belongs to the capability rather than to the tab on screen. The header carries facts only: a DRAFT badge when the document declares itself a draft (a "living" badge says nothing the panel title does not), the drift marker, coverage, what the capability covers and where its file lives — stated once each. Its actions sit in the same footer bar every other viewer state uses, and there is always one: update this spec when it has drifted, otherwise a drift re-check, and beside either an update of every drifted spec. Each resolves the capability's spec tier from the panel's own source anchor and hands off to the shared living-specs commands, so the panel and the sidebar build the same prompts. A covers glob is a place in the repository, so it is a control that reveals that place in the Explorer.

#### Scenario: the architecture tier is selected
- **WHEN** a non-spec tier is displayed
- **THEN** the header still shows the capability's title as authored in its spec tier
- **AND** no workflow status or forward action appears

#### Scenario: the reader asks to update a drifted living spec
- **WHEN** the reader triggers the update from the footer bar
- **THEN** the capability's spec-tier path is resolved from the panel's source anchor, not from the tab on screen
- **AND** the request is routed through the same living-specs update command the sidebar uses, so both entry points fold back identically

#### Scenario: the capability has not drifted
- **WHEN** the panel renders
- **THEN** the footer offers a drift re-check and the update of every drifted spec, so the bar is never empty

#### Scenario: a covers glob is activated
- **WHEN** the reader clicks it
- **THEN** the glob's static prefix is confined to the workspace and revealed in the Explorer; a prefix that is not a real path falls back to a find-in-files scoped to the glob

#### Scenario: the document carries a draft banner near its top
- **WHEN** the spec declares itself a draft
- **THEN** the header badges it as a draft
- **AND** the in-document banner is left intact

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
