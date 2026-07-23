# Viewer UI — Living Spec

> Adopted from existing code on 2026-07-19. Requirements describe observed behavior and have not been individually verified against tests.

## Purpose

This is the reading surface itself: it turns a spec's markdown into a document a person can actually read and annotate, and reflects the run's state back at them without ever deciding what that state is. Without it the extension would have accurate state and nothing to show it on; with it drifting from the extension's state, the reader would be shown a spec that does not exist.

## Requirements

### The viewer is one page whose content is swapped, never reloaded

The webview MUST behave as a single long-lived page. Navigation between documents, and between the overview and the documents, SHALL swap content in place and leave the shell's in-memory state — the reader's current view, mounted comments, scroll memory — intact. Any new navigation path must preserve this: a path that causes the host to regenerate the page loses that state and bounces the reader back to whatever the landing rule picks.

#### Scenario: a document is picked while the overview is showing
- **WHEN** the reader selects a pipeline document from the rail
- **THEN** the document renders and the overview is hidden
- **AND** the reader is not snapped back to the overview

#### Scenario: the reader switches back to the overview
- **WHEN** the overview is re-selected
- **THEN** it appears immediately because the document pane was hidden rather than unmounted

### The webview never decides the run's state — it renders the state it is given

Status, which step is running, which actions exist, and their labels MUST come from the state the extension sends. The webview SHALL NOT re-derive any of them from documents, file presence, or progress numbers. Its own local derivations are limited to presentation: which of the given facts to show, in what order, and how to word them.

#### Scenario: an action set arrives
- **WHEN** the extension sends the catalog of available actions
- **THEN** exactly those actions render, in their declared zones, with their declared scope surfaced in the tooltip
- **AND** no action is invented, suppressed, or relabelled on the basis of anything the webview computed itself

#### Scenario: a step is reported in flight
- **WHEN** the state says the current step is running
- **THEN** the forward-motion action is withheld until the step settles
- **AND** the re-run and closure actions remain available

### A state message replaces the snapshot, it never merges into it

Each state message MUST be treated as complete and applied wholesale. The webview SHALL NOT merge an incoming message onto the snapshot it already holds, and MUST tolerate a state message arriving before any content message. Merging is what allows a fresh field to sit beside a stale one and produce a combination the real spec was never in.

#### Scenario: a state update arrives before the first content
- **WHEN** a state message is the first thing the webview receives
- **THEN** it renders from that state alone
- **AND** nothing waits for a content message that may not come

### One derivation decides whether a step is running

"Is this step in flight?" MUST be answered in exactly one place, and every surface that shows motion — the step's spinner, its live progress label, its elapsed timer, and the footer's forward-motion gate — MUST read that one answer. A settled spec-level status SHALL stop every one of them, even when a step's own completion record never landed. Progress numbers are labels, not run signals: a percentage below complete MUST NOT on its own be read as evidence that anything is running.

#### Scenario: a spec settles with a step's completion unrecorded
- **WHEN** the status names a settled state
- **THEN** no step spins and no elapsed timer runs
- **AND** the forward action reappears

#### Scenario: a status value that names no step
- **WHEN** the status gives no guidance
- **THEN** the answer falls back to local signals — a recorded completion settles the step, an active-step match runs it
- **AND** the step that produces no document of its own is read as running only while the workflow sits on it with work outstanding

### Status values from the record are untrusted keys

Any value that originated in the spec's record or in user configuration — a status, a step name, a document type — MUST NOT be used as a key into a plain object literal for lookups, because inherited properties resolve as truthy hits and an arbitrary value then reads as a legitimate one. Such lookups SHALL use a prototype-free structure.

#### Scenario: a record carries an unexpected status
- **WHEN** a status value that matches an inherited property name is looked up
- **THEN** the lookup misses
- **AND** the surface falls back to its neutral default rather than rendering an inherited value

### Rendered markdown is a commentable document, not just formatted text

The rendering pipeline MUST emit each source line as an addressable, hoverable unit carrying its own line number and an affordance to attach a comment, so annotation works anywhere in the document without a separate mode. Authoring scaffolding that belongs to the generator rather than the reader — front matter, notation legends, metadata already shown in the header — SHALL be stripped rather than rendered. Structured passages the specs use repeatedly (user stories, phased task lists, requirement blocks, acceptance scenarios, callouts) SHOULD be recognised and rendered as their own components rather than as generic prose, and those components stay commentable too.

The attach-a-comment affordance MUST name the specific line it targets in its accessible label rather than carrying a generic one, so that identical controls repeated down the document are distinguishable to assistive technology; the glyph inside it is decorative and MUST be hidden from that tree.

#### Scenario: a line's comment affordance is reached without a pointer
- **WHEN** the reader tabs to a line's add-comment control
- **THEN** it announces the particular line it will annotate, not a generic "add comment"
- **AND** the glyph inside it is hidden from assistive technology

#### Scenario: a document written with foreign line endings
- **WHEN** the source uses carriage returns
- **THEN** line endings are normalised before any block-level parsing
- **AND** the document renders as structure, not as one long paragraph

#### Scenario: the header already shows the spec's metadata
- **WHEN** the state carries the spec's identity
- **THEN** the document's own metadata block is stripped from the rendered body
- **AND** the reader does not see the same facts twice

### User text must never reach an HTML attribute unescaped

Markup that carries content from the document — a link target, an image description, a file reference, a title — MUST be built so the value cannot terminate the attribute it sits in. The escaping used for element *content* does not escape attribute quotes and is not sufficient here; such markup SHALL be assembled with DOM APIs, or escaped with an attribute-safe routine. The content policy is not a substitute for this and MUST NOT be relied on as one.

A destination taken from the document — a link target, an image source — MUST additionally be restricted to schemes that are safe to navigate to or load. A destination carrying a script-executing scheme SHALL NOT render as an active link or a loading image; it is rendered as inert text instead.

#### Scenario: a document contains a quote inside a file reference
- **WHEN** the value is placed into an attribute
- **THEN** the quote cannot close the attribute
- **AND** no additional attribute or handler can be introduced from document text

#### Scenario: a link points at a script-executing destination
- **WHEN** the document supplies a `javascript:` target
- **THEN** it is not rendered as an activatable link
- **AND** nothing the reader can click executes it

### Comments survive re-render by re-anchoring, and the card speaks for where it sits

Persisted comments MUST be restored inline on every render and after every state change, and restoration MUST be idempotent so repeated calls do not duplicate cards. Anchoring is best-effort and follows a fixed precedence — the stored line when its content still matches, else any line matching the stored text, else the first line under the stored heading, else the stored line if it still exists. A comment that matches nothing stays available in the consolidated list rather than being dropped. A restored card MUST describe the line it actually mounted onto; the stored anchor is the *input* to re-anchoring, never its output.

#### Scenario: the document drifts by a line
- **WHEN** a comment's stored line no longer matches but its text is found elsewhere
- **THEN** the card mounts on the line where the text now lives
- **AND** the card reports that line, not the stored one

#### Scenario: a document switch replaces the rendered body
- **WHEN** new content renders
- **THEN** stale mounts are cleared before comments are re-anchored
- **AND** no comment is left pointing at a removed element

### A teardown must unmount what it marked, not re-find it

Anything that marks an element on open — an editor, a comment container — MUST remember the element it marked and act on that reference when closing. Re-deriving the target on teardown by walking the DOM fails whenever the mount is not an ancestor-reachable relative of the trigger, and leaves the element stuck in its opened state forever.

#### Scenario: an editor opened next to a table row is closed
- **WHEN** the editor's container was inserted as a sibling rather than a descendant
- **THEN** the close path still finds and unmounts it
- **AND** the row loses its editing mark

### Comment mutations are posted to the extension, which owns the record

Adding, editing, or removing a comment MUST post the change to the extension rather than write anything itself; the local card is a rendering of the record, not the record. An edit that changes nothing, or that resolves to no target, SHALL be a no-op rather than a posted mutation. Dispatching refinement for a document MUST clear the local cards and let the refreshed record re-render them, so what is shown after the round trip is what was actually persisted.

The line-level structural actions (remove a story, scenario, task, section, or line) are likewise requests the webview posts, not edits it performs. They MUST be labelled as suggestions rather than as direct removals, so the reader is never told a click deletes content the webview does not itself remove.

#### Scenario: a comment is deleted
- **WHEN** the reader deletes a card
- **THEN** the removal is posted, the card unmounts, and focus returns to the line's own control
- **AND** the pending count updates

#### Scenario: a reader picks a structural line action
- **WHEN** the reader chooses to remove a story, scenario, task, section, or line from its menu
- **THEN** the control reads as a suggestion, not a direct removal
- **AND** the request is posted for the AI to act on rather than editing the document in place

### A settled spec is readable but not annotatable

Once a spec is completed or archived, its comments MUST still be visible — they are the record of what was asked — but every path that would create or change one SHALL be closed: the composer refuses to open, and mounted cards render without their action controls. This read-only decision SHALL follow the spec's live status, exactly as the footer's actions already do — it is re-evaluated when the status changes inside an open panel, never fixed at the moment the page was built.

#### Scenario: a completed spec is opened
- **WHEN** the reader hovers a line
- **THEN** the composer does not open
- **AND** existing comments remain visible without edit or delete controls

#### Scenario: a spec settles while its panel is open
- **WHEN** the status becomes completed during the session
- **THEN** the annotation paths close in place
- **AND** the reader does not have to reopen the panel for it to take effect

### Overview and documents are one selection axis

The overview MUST be a destination alongside the documents, not a mode layered over them, so selection can never get stuck between the two. Which one is shown on open is decided by the data — a spec carrying durable context lands on the overview, a spec with only a work log lands on its document — until the reader picks, after which their pick wins. The overview MUST mount lazily on first reveal so it never delays the first document render, and MUST NOT be offered at all for a spec with no recorded run or when the reader has turned it off.

#### Scenario: a spec with only a work log
- **WHEN** the viewer opens
- **THEN** it lands on the document
- **AND** the overview remains reachable from the rail

#### Scenario: any rail item is selected
- **WHEN** the reader picks a document
- **THEN** the overview deselects
- **AND** exactly one rail item reads as current

### The overview degrades section by section, and a failure never blanks the page

Every section of the overview MUST hide itself when its data is empty, so a spec that recorded little shows a short page rather than a page of empty headings. A render-time failure anywhere in the overview subtree MUST be caught, reported back to the extension for diagnosis, and replaced with an inline notice — one bad section may not take the reading surface down with it.

#### Scenario: a section's data is absent
- **WHEN** a spec recorded no decisions
- **THEN** the decisions section does not render at all

#### Scenario: a section throws while rendering
- **WHEN** the overview subtree fails
- **THEN** an inline notice replaces it, the error is reported to the extension, and the rest of the viewer keeps working

### A living spec's title is authored, not derived

A living spec's header MUST show the title as written in the document's own top-level heading and MUST NOT re-case it. Feature specs are named by directory slugs and are capitalised for display; a heading-derived title is a human's own words, and applying slug capitalisation to it silently mangles deliberate casing. The two cases are therefore distinguished explicitly rather than treated alike.

#### Scenario: a capability whose name carries internal capitals
- **WHEN** the title comes from the document's heading
- **THEN** it renders exactly as authored
- **AND** the slug capitalisation applied to feature-spec titles is switched off

### Delegated click handling must survive non-element targets and late mounts

Handlers that delegate from the document MUST confirm the event target is an element before walking up from it, since it can be neither. Delegation — rather than binding to an element at load — is also required for any control that mounts after the page's scripts run, because a direct binding would silently no-op against a control that does not exist yet.

#### Scenario: a click lands on a non-element target
- **WHEN** the delegated handler receives it
- **THEN** it returns without throwing

### Presentation must stay legible and announced

Readable content MUST use the body and primary text tokens; the secondary and muted tokens fall below the accessibility contrast floor on dark themes and are reserved for genuine metadata. Anything a control points at for its accessible description MUST be visually hidden rather than removed from the accessibility tree. Truncation MUST carry its full set of rules or it silently wraps instead. Motion MUST have a still equivalent for readers who ask for reduced motion, and purely decorative glyphs MUST be hidden from assistive technology.

#### Scenario: a status glyph accompanies a label
- **WHEN** the glyph carries no information the label does not
- **THEN** it is hidden from assistive technology
- **AND** the label alone conveys the state

#### Scenario: a reader has asked for reduced motion
- **WHEN** a step is in flight
- **THEN** the in-flight indicator renders without animation

### Run timing is a summary the extension provides, not a duration the webview sums

Elapsed time and per-phase coverage MUST be read from the timing summary the extension sends, never recomputed in the webview from per-step activity timestamps. The webview SHALL NOT sum step spans, cap idle gaps, or otherwise derive a working-time figure of its own; it renders the summary's completion flag, its elapsed figure, and its measured-of-expected phase count as given. A run that has not settled surfaces phase coverage — "N of M phases" — not a fabricated wall-clock total; only a summary that reports itself complete surfaces a start, an elapsed figure, and an end.

Recorded substep events are journal moments, not measured work. Each event carries the timestamp at which it was recorded, is ordered by it, and is shown as "recorded at" that moment. The webview SHALL NOT present the gap between a substep's start and finish as a duration, because an AI or CLI finish is a cadence record rather than a measured piece of work.

#### Scenario: a run is still in flight
- **WHEN** the timing summary reports itself not yet complete
- **THEN** the run surfaces measured-of-expected phase coverage
- **AND** no start, elapsed, or end figure is shown as if the run had settled

#### Scenario: a recorded substep event is displayed
- **WHEN** a tracked substep is rendered in the phase history
- **THEN** it reads as "recorded at" its journal timestamp
- **AND** the span between its start and finish is not presented as a work duration

### The pipeline rail lists document-producing steps only

The rail MUST render only steps that produce a document of their own; steps that merely act — Implement, Mark Complete, any custom step with no document — never appear as rail entries. Every index the rail computes — its root phase, the host of the live implement percent, the in-flight step that locks later tabs — MUST be computed against the rendered list, so a hidden acting step can neither shift a tab nor lock one. An acting step that is running therefore contributes no lock, because it holds no rail position to lock from.

#### Scenario: an acting step is the running step
- **WHEN** a step with no document of its own is in flight
- **THEN** it does not appear in the rail
- **AND** it locks none of the document tabs

### Durable context leads the panel; the granular run history stays collapsed

The activity panel MUST lead with the run's lifecycle signal and durable context — intent, the run's timing overview, the living specs it touched, verified proof, decisions, coverage — and demote the granular run history (phase events, tasks, concerns, files, comments) into a collapsed log below. The living specs a feature touched and its run-timing overview belong to that durable context and render inline in the overview's intent, not as separate run-log cards. A living-spec chip is always a link that opens its capability by name; a stored spec path, when present, rides along but is not required for the chip to be clickable.

#### Scenario: a spec touched living specs
- **WHEN** the overview renders
- **THEN** the touched capabilities appear as links inside the intent, not as a separate card
- **AND** selecting one opens that capability by name

## Uncovered

The following files were not read in full — their exported surface and role were established, but their bodies were not reviewed line by line:

- `webview/src/spec-viewer/markdown/preprocessors.ts` (read partially; only the first ~60 lines and the export inventory)
- `webview/src/spec-viewer/toc.ts`
- `webview/src/spec-viewer/highlighting.ts`
- `webview/src/spec-viewer/relativeTime.ts`
- `webview/src/spec-viewer/activityHeroModel.ts`
- `webview/src/spec-viewer/elapsedFormat.ts`
- `webview/src/spec-viewer/components/InlineEditor.tsx`
- `webview/src/spec-viewer/components/cards/TasksCard.tsx`
- `webview/src/spec-viewer/components/cards/FilesCard.tsx`
- `webview/src/spec-viewer/components/cards/ConcernsCard.tsx`
- `webview/src/spec-viewer/components/cards/CommentsCard.tsx`
- `webview/src/spec-viewer/components/cards/toStringArray.ts`
- `webview/src/spec-viewer/components/index.ts`
- All `*.stories.tsx` files and all files under `__tests__/`

### A recorded step completion settles the step even when status lags

A step whose completion is recorded in the run's history is read as settled, and its forward action reappears, even when the top-level status still names that step as running. A lagging status can never keep a finished step spinning or hold the panel locked.

#### Scenario: history records the current step complete but status still names it running

- **WHEN** the current step's completion is present in history but the top-level status still names that step as in progress
- **THEN** the step reads as settled and no spinner runs
- **AND** the forward-motion action reappears

#### Scenario: the step is genuinely still running

- **WHEN** the current step's latest history entry is a start with no matching completion
- **THEN** the step reads as running and the forward action stays withheld

> The companion requirement for #492 — fold-back naming its exact outcome and surfacing loaded-but-unfolded capabilities — is recorded in the `capture-runtime` living spec's own change record and the spec-kit extension CHANGELOG, not folded here: the fold grammar applies one delta set to its target, so routing this feature's cross-cutting change through a single `viewer-ui` block keeps each capability spec honest.
