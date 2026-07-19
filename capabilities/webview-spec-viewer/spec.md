# Webview Spec Viewer — Living Spec

> [DRAFT] Surface-first draft from existing code — every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

The webview half of the spec viewer turns a spec's markdown and its captured run state into a readable, reviewable document inside a VS Code webview. Without it there is no rendered spec, no inline review affordance, and no Overview of what a run actually did — the extension would have state with nowhere to show it.

## Requirements

### Markdown renders through one deterministic pipeline

Rendering MUST be a single ordered pass: normalize the source, strip authoring scaffolding, run a sequence of pattern preprocessors that lift recognized spec structures into pre-built markup, then scan the result line by line for block constructs. Preprocessors MUST be additive — adding, removing, or reordering one MUST NOT require changing the block scanner, and the scanner MUST pass through markup a preprocessor already emitted rather than re-parsing it as prose.

#### Scenario: A recognized spec structure is lifted
- **WHEN** the source contains a structure a preprocessor recognizes (a user story heading, a requirement bullet, a scoped section, a callout)
- **THEN** the preprocessor replaces it with the finished markup for that structure
- **AND** the block scanner emits that markup unchanged instead of treating it as a paragraph

#### Scenario: Source the pipeline does not recognize
- **WHEN** the source contains ordinary markdown (headings, lists, tables, code fences, blockquotes)
- **THEN** the block scanner renders it with standard semantics
- **AND** unrecognized content never falls through as raw or escaped source text

### Rendered content is addressable for inline review

Every reader-facing line of the document — paragraph, list item, heading below the top levels, scenario item, and lifted component — MUST carry its originating source line number and a comment affordance. A new rendering path that emits reader-facing content MUST attach the same addressing, or that content becomes silently un-reviewable.

#### Scenario: Reader comments on a line
- **WHEN** the reader activates the comment affordance on any rendered line
- **THEN** a composer opens anchored to that line
- **AND** submitting it records a comment carrying that line's source number and its text

#### Scenario: A destructive quick action is chosen
- **WHEN** the reader picks a remove-style quick action offered for the line's detected type
- **THEN** the viewer records it as a review comment requesting the removal
- **AND** the viewer does NOT delete the content itself

### Persisted comments re-anchor rather than disappear

On every render and document switch, the viewer MUST re-place the current document's stored comments against the freshly rendered lines using a defined fallback order, and MUST NOT drop a comment whose stored line number has drifted. A comment that matches nothing inline SHALL remain reachable from the Activity list rather than vanishing. Re-placement MUST be idempotent — repeating it for an unchanged comment changes nothing.

#### Scenario: Line numbers shifted since the comment was written
- **WHEN** the document is re-rendered and the stored line no longer holds the stored text
- **THEN** the viewer anchors the comment to the line matching its stored content, or failing that to the first line under its stored heading
- **AND** the mounted comment reports the line it now sits on

#### Scenario: State refreshes while comments are mounted
- **WHEN** updated state arrives carrying the same comments
- **THEN** already-mounted unchanged comments are left alone
- **AND** a comment whose text or status changed re-renders in place

### A settled spec is readable but not editable

When the spec's lifecycle status is terminal, the viewer MUST still display existing review comments and their status, and MUST refuse to open composers or offer mutation controls for them.

#### Scenario: Viewing a completed or archived spec
- **WHEN** the reader opens a spec at a terminal status and activates a comment affordance
- **THEN** no composer opens
- **AND** existing comments render with their status, without edit or delete controls

### The webview proposes; the extension disposes

The webview MUST NOT be the authority on any persisted state. Every user action that changes a spec — a comment added, edited, or removed, a checkbox toggled, a document switched, a lifecycle or footer action, a refinement run — MUST be expressed as a message to the extension, and the resulting change MUST be observed by way of the state the extension pushes back. Local DOM updates are permitted only as optimistic echo of a message already sent.

#### Scenario: Reader toggles a task checkbox
- **WHEN** a task checkbox is toggled
- **THEN** the viewer sends the toggle with its source line number to the extension
- **AND** any immediate visual update is presentational only, superseded by the next pushed state

### Pushed state replaces, never merges

State arriving from the extension MUST fully replace the viewer's prior snapshot for the state it carries, so that a partial or stale merge cannot produce a viewer that shows a combination the extension never sent. State messages MUST be safe to arrive in any order, including before the first content render.

#### Scenario: A state update lands before any content
- **WHEN** a state update arrives before the first document content
- **THEN** the viewer adopts it as the current snapshot and renders from it
- **AND** the later content message does not resurrect any earlier snapshot

### One derivation answers "is this step running"

Whether a workflow step is in flight MUST be computed in exactly one place, from the spec status first and local step evidence second. Every surface that reacts to a running step — the step rail, the footer, elapsed indicators — MUST read that one answer, so no two surfaces can disagree about what is running.

#### Scenario: A step is running
- **WHEN** the spec's status names a step as in flight
- **THEN** that step's rail entry shows motion and later steps that have produced nothing are not selectable
- **AND** the footer withholds the forward-motion action until the step settles

#### Scenario: The status has settled
- **WHEN** the status is a settled one
- **THEN** no step reports as in flight, regardless of leftover step-history entries

### The viewer never fabricates a fact it cannot support

Derived run facts — durations, counts, coverage, progress — MUST be omitted entirely when their source data is absent, rather than shown as zero or an empty ratio. Durations MUST be presented only for spans whose boundaries were recorded by a trusted writer; untrusted or synthesized spans SHALL render name-only. Elapsed time SHOULD reflect active working time with long idle gaps capped, not raw wall-clock.

#### Scenario: A step's timing was not trustworthily recorded
- **WHEN** a step has history but its span is not marked trusted
- **THEN** the step renders without a duration
- **AND** the run's overall timing summary excludes it

#### Scenario: No run data of a given kind exists
- **WHEN** the state carries no tasks, no coverage, or no concerns
- **THEN** the corresponding fact is absent from the header strip rather than shown as `0`

### The Overview exists only when there is something to show

Whether the viewer offers an Overview, and whether it lands there, MUST be derived from the state itself — a spec with no recorded run has no Overview, and a spec whose record is only a work log has one but does not lead with it. The Overview's sections MUST each render only when their own data exists. The reader's explicit choice MUST override the derived landing for the session.

#### Scenario: Spec with durable reasoning captured
- **WHEN** the state carries intent, decisions, expectations, verification, or coverage
- **THEN** the Overview is offered and is where the viewer lands

#### Scenario: Spec with nothing recorded
- **WHEN** the state carries no run record at all
- **THEN** the Overview is not offered and the document is the only destination

### A failing panel does not take down the viewer

Render-time failures in the Overview subtree MUST be contained so a single bad card cannot blank the viewer. A contained failure MUST render an inline notice in place of the failed region and MUST be reported to the extension for diagnostics.

#### Scenario: A card throws while rendering
- **WHEN** a component in the Overview subtree throws during render
- **THEN** the rest of the viewer keeps working and the region shows an error notice
- **AND** the error is posted to the extension

### The document outline rebuilds cleanly and adapts to the reading width

The outline MUST be rebuildable at any time — on document switch, on preference change, on width crossing — without leaking observers or listeners from the previous build. It MUST present the same links in a persistent column when there is room and as a compact disclosure when there is not, and MUST NOT disappear at narrow widths. It MUST omit headings that are authoring scaffolding rather than destinations.

#### Scenario: Reader switches documents repeatedly
- **WHEN** the outline is rebuilt for a new document
- **THEN** the previous build's observers and handlers are torn down first
- **AND** the outline reflects only the current document's headings

#### Scenario: The reading pane narrows past the threshold
- **WHEN** the available width crosses below the outline's minimum
- **THEN** the outline re-forms as a disclosure above the document with the same links and tracking
- **AND** it re-forms as a column when the width crosses back

#### Scenario: The viewer is closed and reopened
- **WHEN** the reader had expanded subsections and then reopens the viewer
- **THEN** the outline returns to its default depth
- **AND** the expansion preference is deliberately per-session, not carried across panels

### Components carry stories that match their real states

Every non-trivial viewer component SHOULD have a stories file, and a change to a component's states or variants MUST be reflected in its stories in the same change. [inferred — the sync obligation is stated as a repo convention in `CLAUDE.md`; the code surface only shows that the story files exist alongside the components] Stale stories are worse than absent ones because they present a state the component can no longer reach.

#### Scenario: A component gains a new visual state
- **WHEN** a component is changed to render a new state or variant
- **THEN** its stories file gains coverage for that state in the same change

## Uncovered

Read in full: the entry point and app shell, the signals/state layer, the markdown pipeline (renderer, preprocessors, scenarios, inline), the editor layer (line actions, inline editor, refinements, re-anchoring, restore, editor host, read-only, current-doc), the outline builder, highlighting, the derived models (in-flight, overview, hero stats, timeline events, elapsed/relative time), and the main components (App, NavigationBar, StepTab, FooterActions/CatalogFooter, ActivityPanel, OverviewDossier, PageChrome, SpecHeader, RunStrip, StaleBanner, InlineComment, InlineEditor, ElapsedTimer, TimelineEvent, error boundary, and the Phases/Tasks/Comments/Living-Specs cards).

Not read (surface only or not opened):

- `webview/src/spec-viewer/components/cards/FilesCard.tsx` — opened only to its props declaration
- `webview/src/spec-viewer/components/cards/ConcernsCard.tsx`
- `webview/src/spec-viewer/components/cards/toStringArray.ts`
- `webview/src/spec-viewer/components/cards/LivingSpecsCard.tsx` — read partially; the tail rendering the requirement rows was not read
- `webview/src/spec-viewer/relativeTime.ts` — export signatures only, not the formatting/idle-gap bodies
- All `*.stories.tsx` files and `components/__stories__/` (deliberately not inventoried)
- All `*.test.ts` / `*.test.tsx` files and the `__tests__/` directories
