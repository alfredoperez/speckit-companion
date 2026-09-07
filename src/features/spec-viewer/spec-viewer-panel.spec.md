# Spec Viewer Panel — Living Spec

> Adopted from existing code on 2026-07-19. Requirements describe observed behavior and have not been individually verified against tests.

## Purpose

The panel side of the spec viewer: one panel per spec, the complete state snapshot every refresh ships, the read-only stance toward the spec's record, the locked-down webview shell and the message contract it shares with the webview.

## Requirements
### One panel per spec, revealed rather than duplicated

Opening any document of a spec MUST resolve to that spec's own panel. A second open — of the same document, a sibling document, or the spec as a whole — SHALL reuse and reveal the existing panel rather than creating another. Panels are keyed by the spec's directory so a spec can never end up with two disagreeing views of itself, and closing a panel MUST release everything scoped to it (pending timers, per-spec notification memory).

#### Scenario: opening a sub-document of an open spec
- **WHEN** the reader opens a document that lives under a directory a panel already owns
- **THEN** that panel switches to the document and comes to the front
- **AND** no second panel is created

#### Scenario: the panel is closed
- **WHEN** a panel is disposed
- **THEN** its pending work and its per-spec notification state are discarded
- **AND** reopening the spec starts from a clean panel

The entry point's landing request rides with the panel. Opening a document asks to land on that document; opening the spec as a whole asks to land on the Overview. The request MUST be carried on the first render — the webview's own state does not survive the panel HTML being regenerated — and re-sent on every state update, and the reader's later choice of the Overview inside the viewer SHALL clear it, so a content refresh cannot bounce them back.

#### Scenario: a document row is opened on a spec that has been run
- **WHEN** the panel renders
- **THEN** it lands on that document, not the Overview

#### Scenario: the reader chooses the Overview, then a file in the spec changes
- **WHEN** the panel re-renders
- **THEN** it stays on the Overview

### Every refresh ships a complete state snapshot from one builder
<!-- touches: src/features/spec-viewer/specViewerProvider.ts -->

Both refresh paths — a document switch and a change to the spec's recorded context — MUST build their payload through one shared builder and send a *complete* state, never a partial merged onto whatever the webview last held. A payload that omits a state-bearing field would let the webview keep a stale value beside fresh ones, which is how the footer once offered an action the spec's real state did not permit. A snapshot also carries facts that belong to the project rather than to the spec — whether the spec-kit half is missing or out of date — so when those change on disk every open run panel MUST be re-posted a fresh snapshot rather than left waiting for one of its own files to change.

#### Scenario: the recorded context changes on disk
- **WHEN** a watcher reports a change to an open spec's recorded context
- **THEN** the viewer re-derives state and posts a complete snapshot
- **AND** the reader sees the settled state without switching tabs or reloading

#### Scenario: a refresh that carries no document content
- **WHEN** the refresh is triggered by state alone
- **THEN** document and staleness reads are skipped as unnecessary work
- **AND** the snapshot remains internally consistent by reusing the panel's cached values for the fields it did not recompute

#### Scenario: the spec-kit extension lands on disk while panels are open
- **WHEN** the files that decide the install nudge change
- **THEN** every open run panel is re-posted a complete snapshot
- **AND** the nudge settles without the reader touching a spec file

### Reading a spec must never damage its record

The viewer SHALL treat the spec's recorded context as read-only after the first open. It MAY create a minimal record when none exists at all, but a record that exists and cannot be parsed MUST be rendered from an in-memory stand-in and left untouched on disk. Repairing a corrupt record is the reader's explicit decision, taken through an offer that backs up the original first.

#### Scenario: the record is unreadable mid-write
- **WHEN** the record cannot be parsed during a render
- **THEN** the panel renders from a minimal in-memory stand-in
- **AND** nothing is written over the file on disk

#### Scenario: the reader accepts a reset
- **WHEN** the reader chooses to reset a corrupt record
- **THEN** the original is backed up before a fresh record is written
- **AND** the open panel refreshes onto the repaired state

### The install nudge is resolved per render, and a click reports the banner the reader saw
<!-- touches: src/features/spec-viewer/specViewerProvider.ts, src/features/spec-viewer/html/generator.ts, src/features/spec-viewer/messageHandlers.ts -->

Which spec-kit-extension nudge belongs on screen — none, an install, or an update naming the installed and expected versions — MUST be resolved through the one shared resolver that already weighs the setting, what is on disk, and any dismissal, and the whole prompt SHALL be carried to the webview on the first render and re-sent on every state update, never reduced to a bare "show it" flag. The banner lives inside the Activity panel, so with that panel off nothing is resolved and nothing is reported as shown; when a banner does render, the shown report names which kind it is. The banner's own messages MUST carry the prompt back as the banner declared it, because the extension's view of the gap can have moved on since it was drawn: the click report names the update surface rather than the install one, and the dismissal is persisted through the single dismissal writer against the banner the reader actually closed — permanently for the install nudge, and only for that expected version for an update, so the next release asks again.

#### Scenario: the installed commands are behind this build
- **WHEN** the panel renders
- **THEN** the update prompt is sent with both versions
- **AND** the shown report names the update surface, not the install one

#### Scenario: an update banner is dismissed
- **WHEN** the reader closes it
- **THEN** only the version pair the banner named is silenced
- **AND** the panel refreshes without the banner

### Opening a spec can name the requirement to bring into view

The viewer's open command SHALL accept an optional requirement heading and, once the spec renders, bring the matching requirement into view. A heading matching nothing SHALL leave the document where it is rather than failing the open.

#### Scenario: a requirement heading that does not exist
- **WHEN** the spec is opened with it
- **THEN** the spec still opens and no error is shown

### The webview shell is generated under a locked-down policy

Each render MUST emit its own content-security policy with a freshly generated per-render nonce, restrict resource loading to the extension's own assets plus the explicitly named script sources, and escape every value interpolated into the shell. Element-content escaping is not attribute-safe, so a document body carried through an HTML attribute SHALL be base64-encoded and decoded by the webview rather than escaped — the helper that does it is named for the encoding it performs, not for escaping, because a name that says "escape" invites its use where no escaping is happening. Regenerating the shell is also what resets the webview's in-memory selection, so any navigation meant to preserve that selection MUST go through a message instead.

#### Scenario: a pipeline entry is selected
- **WHEN** the reader picks a document from the pipeline rail
- **THEN** only the content is swapped by message
- **AND** the shell is not regenerated, so the reader's current view is preserved

#### Scenario: a document containing markup is rendered into the shell
- **WHEN** the raw document is placed in the attribute the webview reads it from
- **THEN** it is base64-encoded, so no character in it can terminate the attribute

### The viewer's message contract is declared once, for both sides

The set of messages the panel and its webview exchange, and the document types they name, SHALL live in one shared protocol module both sides import, not be restated in the extension-side types file. The two ends cannot then hold different ideas of what a message is, and a variant added on one side is visible to the other by construction.

#### Scenario: a message variant is added
- **WHEN** the protocol gains a new message type
- **THEN** both the panel and the webview see the same declaration without either restating it

## Uncovered

_None — every file in the area was read, though the test files under `__tests__/` were read only for the contracts they pin, not line by line._
