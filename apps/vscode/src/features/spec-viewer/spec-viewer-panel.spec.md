# Spec Viewer Panel — Living Spec

<!-- reviewed: d589a63e -->

## Purpose

The extension-side host for a spec's reading surface: one panel per spec, kept current as the spec's files and record change on disk.

## Requirements

### One panel per spec, revealed rather than duplicated

Opening any document of a spec SHALL reveal that spec's existing panel, keyed by the spec's directory, instead of creating another.

#### Scenario: opening a sub-document of an open spec
- **WHEN** the reader opens a document under a directory a panel already owns
- **THEN** that panel switches to the document and comes to the front, and no second panel is created

### The reader's choice of view survives a refresh

Once the reader picks the Overview or a document, a later refresh SHALL keep showing that pick. The pick is recorded as the Overview or a named document, never as no choice, because an absent choice falls back to the opened document.

#### Scenario: the reader chooses the Overview, then a file in the spec changes
- **WHEN** the panel re-renders
- **THEN** it stays on the Overview

### An open panel shows the settled state when the spec's record changes on disk
<!-- touches: apps/vscode/src/features/spec-viewer/specViewerProvider.ts -->

When an open spec's recorded context changes on disk, the panel SHALL re-derive its state and replace the webview's state whole, never merge a partial update onto the last one.

#### Scenario: a step completes while the panel is open
- **WHEN** the run writes the step's completion to the record
- **THEN** the panel shows the step settled without the reader switching tabs or reloading

### The install nudge settles in every open panel when the spec-kit extension changes on disk
<!-- touches: apps/vscode/src/features/spec-viewer/specViewerProvider.ts -->

When the files that decide the spec-kit extension nudge change, every open run panel SHALL be refreshed.

#### Scenario: the spec-kit extension is installed while panels are open
- **WHEN** its files land on disk
- **THEN** every open run panel drops the install banner without the reader touching a spec file

### Document text cannot break out of the webview shell

A document body carried into the shell through an HTML attribute SHALL be base64-encoded, because element-content escaping does not escape attribute quotes. Every other value interpolated into the shell SHALL be escaped.

#### Scenario: a document containing markup and quotes is rendered
- **WHEN** the panel builds the shell for it
- **THEN** the document renders as text and adds no element or attribute to the shell

### The webview loads only the extension's own scripts

Each render SHALL emit a content-security policy with a fresh nonce, allowing scripts only from the extension's assets and the named script sources.

#### Scenario: the panel is rendered twice
- **WHEN** the two shells are compared
- **THEN** each carries a different nonce in its policy

### The Activity panel's install banner reports the variant the reader saw
<!-- touches: apps/vscode/src/features/spec-viewer/specViewerProvider.ts, apps/vscode/src/features/spec-viewer/messageHandlers.ts -->

The banner's shown report and its click report SHALL name the update surface for an update prompt and the install surface for an install prompt.

#### Scenario: the installed commands are behind this build
- **WHEN** the panel renders and the reader clicks the banner
- **THEN** both the shown and the click report name the update surface

### No install nudge is shown or counted while the Activity panel is off
<!-- touches: apps/vscode/src/features/spec-viewer/specViewerProvider.ts, apps/vscode/src/features/spec-viewer/html/generator.ts -->

With the Activity panel setting off, the panel SHALL send no install prompt and report no banner as shown.

#### Scenario: the Activity panel is turned off and the extension is missing
- **WHEN** a spec opens
- **THEN** no banner renders and no shown event is reported

### Closing the install banner removes it at once
<!-- touches: apps/vscode/src/features/spec-viewer/messageHandlers.ts -->

Dismissing the banner SHALL record the dismissal for the prompt the banner showed and refresh the panel.

#### Scenario: an update banner is dismissed
- **WHEN** the reader closes it
- **THEN** the panel refreshes without the banner

### A document is addressed by its path under the spec

A document SHALL be identified by its path relative to the spec directory, so a subfolder stays part of its identity. A path that resolves to no document SHALL raise a warning rather than silently keep showing the previous document.

#### Scenario: a document in a subfolder is opened
- **WHEN** the reader opens a document nested under the spec directory
- **THEN** that document is what renders

#### Scenario: a click names a document the scan never listed
- **WHEN** the path resolves to nothing
- **THEN** a warning names the missing document

### Opening a spec can name the requirement to bring into view

The viewer's open command SHALL accept an optional requirement heading and bring that requirement into view once the spec renders. A heading that matches nothing SHALL still open the spec without an error.

#### Scenario: a requirement heading that does not exist
- **WHEN** the spec is opened with it
- **THEN** the spec opens and no error is shown

## Uncovered

_None: every file in the area was read, though test files under `__tests__/` were read only for the contracts they pin._
