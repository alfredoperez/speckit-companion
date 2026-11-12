# Feature Specification: The spec viewer as an embeddable element

**Source**: #983

**Feature Branch**: `feat/983-v5-v9-factory`
**Status**: Draft
**Input**: Slices V5 and V6 of #983, plus the strict-typing fixes Factory needs for V9.

## User Scenarios & Testing

### User Story 1 - The VS Code viewer looks and works exactly as before (Priority: P1)

A VS Code user opens any spec in the Companion viewer. The rail, the Overview, the documents, the footer, comments and banners look and behave as they did yesterday, even though the view now lives in the shared package and talks to the extension through one action channel.

**Why this priority**: The extension is the product people use today. Sharing the view is worthless if it changes what they see.

**Independent Test**: Build main and the branch, compare the computed styles of every viewer story and the webview bundles, and run the full test suite and the packaging check.

**Acceptance Scenarios**:

1. **Given** a main build and a branch build, **When** every viewer story is rendered under each side's extension stylesheet, **Then** every element's computed style matches.
2. **Given** the viewer is open, **When** the reader clicks a rail step, a document link, a file reference, a task box or a footer button, **Then** the extension receives the same message it received before.
3. **Given** the webview has no network, **When** a document with code blocks opens, **Then** the code is highlighted with the same colours as before.

### User Story 2 - Another app renders a spec with one element (Priority: P1)

A developer of another app (Factory first) adds `<speckit-viewer>` to a page, hands it a spec's record, its document list and the current document's text, and gets the same viewer the extension shows: rail, Overview, rendered document, table of contents. Moving between the folder's documents works inside the element; the app hears every action as a DOM event.

**Why this priority**: This is what lets Factory drop its hand-converted copy, the reason for the whole issue.

**Independent Test**: Load the element bundle in a plain page with a fixture spec and the theme stylesheet, click through it in headless Chrome, and check the events that come out.

**Acceptance Scenarios**:

1. **Given** a page with the element and a fixture spec, **When** it loads, **Then** the rail lists the documents and the Overview or the current document shows, with code highlighted and no network request for scripts.
2. **Given** the element shows a spec, **When** the reader clicks another step on the rail, **Then** the element switches to that document and emits a `speckit-action` event naming it, and the host can supply the new document's text.
3. **Given** the host puts its own buttons in the element with `slot="actions"`, **When** the element renders, **Then** those buttons show above the rail and the document and stay owned by the host.
4. **Given** the record is missing, **When** the element renders, **Then** it shows the documents without an Overview and does not throw.

### User Story 3 - The package type-checks in a strict consumer (Priority: P2)

Factory compiles with unchecked index access forbidden. The package's source compiles there without errors and without the consumer loosening its settings.

**Why this priority**: Without it Factory must hide the package behind `@ts-nocheck`, as its copy does today.

**Independent Test**: Type-check the package with unchecked index access forbidden.

**Acceptance Scenarios**:

1. **Given** the package's own type-check runs with unchecked index access forbidden, **When** it runs, **Then** it reports no errors.

## Edge Cases

- The host gives a `currentDoc` that is not in the document list: the element shows the first core document.
- The host has not supplied the text of the document the reader just switched to: the element shows a reading state until `content` arrives.
- `documents` changes while the reader is on a document that disappears: the element falls back to the first document.
- Two elements on one page: out of scope; the view keeps one viewer per page, as today.
- A language the bundled highlighter does not know: the code shows unhighlighted, as today.
- No action handler is set: actions are dropped silently, never thrown.

## Requirements

### Functional Requirements

- **FR-001**: The view MUST send every outgoing message through one typed action function; no view module calls the VS Code API.
- **FR-002**: The action type MUST be the existing outgoing message union, exported from the package's contract as `ViewerAction`.
- **FR-003**: The host-neutral view (shell, rail, header, Overview and its cards, timeline, timers, signals, table of contents, highlighting, document links) MUST live in the package and be exported as Preact components.
- **FR-004**: Extension-only parts (inline editor and comments, footer actions, banners, report pages, toasts, the message router) MUST stay in the extension and reach the package's shell through slot props.
- **FR-005**: The VS Code webview MUST route the action function to the extension's message channel, so the extension receives exactly the messages it received before.
- **FR-006**: The VS Code viewer's computed styles MUST match main's for every viewer story.
- **FR-007**: The package MUST register a `<speckit-viewer>` custom element that renders the view in the light DOM.
- **FR-008**: The element MUST accept `record`, `documents`, `currentDoc`, `content`, `landing` and `live` as properties and derive the navigation and viewer state itself.
- **FR-009**: The pure derivations the element needs (phase, step history, viewer state, badge and dates) MUST move into the package core, with the extension importing them from there.
- **FR-010**: The element MUST emit every action as a bubbling, composed `speckit-action` event whose detail is the action.
- **FR-011**: The element MUST switch documents itself on a rail click or a link to another document of the folder, and still emit the action.
- **FR-012**: The element MUST show light-DOM children marked `slot="actions"` above the rail and the document.
- **FR-013**: Syntax highlighting MUST be bundled (same highlighter version, same languages, same stylesheet), in the element and in the VS Code webview, so neither loads it from a CDN.
- **FR-014**: The package MUST build an ES module bundle of the element with Preact and the highlighter inside, plus type declarations.
- **FR-015**: The package source MUST type-check with unchecked index access forbidden.
- **FR-016**: The extension's packaging check and full test suite MUST pass.

### Key Entities

- **ViewerAction**: one outgoing message from the view (navigate, open a file, toggle a box, run a footer action, report an error).
- **Spec documents**: the folder's documents as the rail shows them: type, label, file name and path, whether it exists, core or related, and the step a related document hangs under.
- **Spec record**: the spec's `.spec-context.json`, or nothing.

## Success Criteria

### Measurable Outcomes

- **SC-001**: 100% of viewer stories render with identical computed styles on main and the branch (the one known scroll-timing flake excepted).
- **SC-002**: Zero direct VS Code API calls remain in the package's view modules.
- **SC-003**: A page with only the element bundle and its stylesheets renders a fixture spec with zero script requests to a CDN.
- **SC-004**: The package type-check with unchecked index access forbidden reports zero errors.
- **SC-005**: The extension's full test suite and packaging check pass.

## Assumptions

- Mermaid stays opt-in and loaded by the host from its CDN, as today.
- One viewer per page; the view's state stays module-level.
- The element takes the current document's text from the host; it never reads files.
- Slots are light-DOM children positioned by the element, not shadow-DOM slots, because the view and its scoped CSS live in the light DOM.
- Publishing the package, moving the stories, the Copilot canvas and the Claude Code mod are later slices.

## Verbatim Constraints

- Element tag: `speckit-viewer`
- Event name: `speckit-action`
- Slot name: `actions`
- Action type name: `ViewerAction`
- Entry points: `speckit-viewer/view`, `speckit-viewer/element`
- Element properties: `record`, `documents`, `currentDoc`, `content`, `landing`, `live`
- Highlighter version: `11.9.0`
