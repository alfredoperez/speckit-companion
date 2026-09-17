# Spec Viewer Panel — Living Spec

<!-- reviewed: d589a63e -->

> [DRAFT] Surface-first draft from existing code. Every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

The extension-side host for one spec's reading surface: one panel per spec, a shell generated under a locked-down policy, and every refresh carrying a complete snapshot.

## Requirements

### One panel per spec, revealed rather than duplicated

Opening any document of a spec MUST resolve to that spec's own panel, keyed by the spec's directory. A second open of the same document, a sibling, or the whole spec SHALL reveal the existing panel instead of creating another. Closing a panel MUST release everything scoped to it, including pending timers and per-spec notification memory.

#### Scenario: opening a sub-document of an open spec
- **WHEN** the reader opens a document under a directory a panel already owns
- **THEN** that panel switches to the document and comes to the front
- **AND** no second panel is created

#### Scenario: the panel is closed
- **WHEN** a panel is disposed
- **THEN** its pending work and per-spec notification state are discarded
- **AND** reopening the spec starts from a clean panel

Opening a document asks to land on that document, and opening the whole spec asks to land on the Overview. The landing request MUST be carried on the first render and re-sent on every state update, and a render that rebuilds panel state MUST carry the existing state forward so the request is not dropped. The reader's later choice in the viewer SHALL be recorded as that choice (the Overview or a specific document), never as no choice, because an absent request falls back to the document on refresh.

#### Scenario: a document row is opened on a spec that has been run
- **WHEN** the panel renders
- **THEN** it lands on that document, not the Overview

#### Scenario: the reader chooses the Overview, then a file in the spec changes
- **WHEN** the panel re-renders
- **THEN** it stays on the Overview

#### Scenario: the spec name is clicked in a panel already used to read documents
- **WHEN** the panel re-renders
- **THEN** it lands on the Overview

### Every refresh ships a complete state snapshot from one builder
<!-- touches: src/features/spec-viewer/specViewerProvider.ts -->

Both refresh paths, a document switch and a recorded-context change, MUST build their payload through one shared builder and send a complete state, never a partial merged onto the webview's last state. When project-level facts in the snapshot change on disk, such as the spec-kit half being missing or out of date, every open run panel MUST be re-posted a fresh snapshot.

#### Scenario: the recorded context changes on disk
- **WHEN** a watcher reports a change to an open spec's recorded context
- **THEN** the viewer re-derives state and posts a complete snapshot
- **AND** the reader sees the settled state without switching tabs or reloading

#### Scenario: a refresh that carries no document content
- **WHEN** the refresh is triggered by state alone
- **THEN** document and staleness reads are skipped
- **AND** the snapshot stays consistent by reusing the panel's cached values for fields it did not recompute

#### Scenario: the spec-kit extension lands on disk while panels are open
- **WHEN** the files that decide the install nudge change
- **THEN** every open run panel is re-posted a complete snapshot
- **AND** the nudge settles without the reader touching a spec file

### The webview shell is generated under a locked-down policy

Each render MUST emit its own content-security policy with a fresh per-render nonce, restrict resource loading to the extension's assets and the named script sources, and escape every value interpolated into the shell. A document body carried through an HTML attribute SHALL be base64-encoded and decoded by the webview, because element-content escaping is not attribute-safe, and its helper is named for the encoding, not for escaping. Navigation that must preserve the webview's in-memory selection MUST go through a message, since regenerating the shell resets it.

#### Scenario: a pipeline entry is selected
- **WHEN** the reader picks a document from the pipeline rail
- **THEN** only the content is swapped by message
- **AND** the shell is not regenerated, so the reader's current view is preserved

#### Scenario: a document containing markup is rendered into the shell
- **WHEN** the raw document is placed in the attribute the webview reads it from
- **THEN** it is base64-encoded, so no character in it can terminate the attribute

### The viewer's message contract is declared once, for both sides

The messages the panel and webview exchange, and the document types they name, SHALL live in one shared protocol module both sides import, not be restated in the extension-side types file.

#### Scenario: a message variant is added
- **WHEN** the protocol gains a new message type
- **THEN** both the panel and the webview see the same declaration without either restating it

### The install nudge is resolved per render, and a click reports the banner the reader saw
<!-- touches: src/features/spec-viewer/specViewerProvider.ts, src/features/spec-viewer/html/generator.ts, src/features/spec-viewer/messageHandlers.ts -->

The spec-kit-extension nudge (none, install, or an update naming installed and expected versions) MUST be resolved through the one shared resolver, and the whole prompt SHALL be sent on first render and every state update, never as a bare flag. With the Activity panel off, nothing is resolved or reported as shown, and a rendered banner's shown report names its kind. The banner's messages MUST carry back the prompt it declared: the click report names the update surface for an update, and dismissal goes through the single dismissal writer for the banner closed, permanently for install and only for that expected version for an update.

#### Scenario: the installed commands are behind this build
- **WHEN** the panel renders
- **THEN** the update prompt is sent with both versions
- **AND** the shown report names the update surface, not the install one

#### Scenario: an update banner is dismissed
- **WHEN** the reader closes it
- **THEN** only the version pair the banner named is silenced
- **AND** the panel refreshes without the banner

### A document is addressed by its path under the spec

A document MUST be identified by its path relative to the spec directory, so a subfolder stays part of its identity. Every path that names a document, including the listing scan and a click, MUST derive that identity through one shared derivation. A mismatched identity resolves to no document, and the panel would otherwise keep showing the previous one.

#### Scenario: a document in a subfolder is opened
- **WHEN** the reader opens a document nested under the spec directory
- **THEN** that document is what renders

#### Scenario: a click names a document the scan never listed
- **WHEN** the identity resolves to nothing
- **THEN** the panel says so instead of silently keeping the previous document

### Opening a spec can name the requirement to bring into view

The viewer's open command SHALL accept an optional requirement heading and bring the matching requirement into view once the spec renders. A heading that matches nothing SHALL leave the document in place without failing the open.

#### Scenario: a requirement heading that does not exist
- **WHEN** the spec is opened with it
- **THEN** the spec still opens and no error is shown

## Uncovered

_None: every file in the area was read, though test files under `__tests__/` were read only for the contracts they pin._
