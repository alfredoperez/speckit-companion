# Rendering Contracts — Living Spec

> Adopted from existing code on 2026-07-19. Requirements describe observed behavior and have not been individually verified against tests.

## Purpose

The correctness contracts a consuming webview must satisfy when it renders spec markdown: source-line addressability, a single line classifier, untrusted-content escaping, and document-derived progress. The implementations live in the viewer; this file is the shared contract.

## Requirements

> The rendering, classification, and overlay requirements below are the contracts a consuming webview must satisfy. Their implementations live in the viewer, not in this shared area — the standalone copies here were removed.

### Rendered documents stay addressable back to their source lines

Rendering MUST preserve the mapping from each interactive element to the line number it came from in the original markdown, and consumers MUST act on that number rather than on the rendered DOM. Editing, deleting, and refinement all mutate a file on disk; the rendered tree is a lossy projection of that file, so anything derived from the DOM instead of the source position will eventually target the wrong line.

#### Scenario: a line is edited in place
- **WHEN** the user commits an inline edit
- **THEN** the request identifies the source line and the new plain text
- **AND** the extension — not the webview — is what rewrites the file

#### Scenario: content the user cannot act on
- **WHEN** a region is not individually editable (a fenced block, a rule, a top-level title)
- **THEN** it renders without per-line controls rather than with controls that would misfire

### One classifier decides what each line is and what may be done to it

Whether a line can be deleted and whether it can be refined MUST come from a single classification pass, and both the renderer and any consumer offering those affordances MUST read the same answer. Two independent opinions about "is this removable" drift, and the failure is silent: a control appears that the handler will not honour, or a legitimate action is hidden.

#### Scenario: a structural heading is rendered
- **WHEN** the line defines document or section structure
- **THEN** no delete affordance is offered, because deleting it would orphan everything beneath

#### Scenario: an unrecognised line shape appears
- **WHEN** content matches no known markdown shape
- **THEN** it still renders as readable prose with the affordances its classification grants, rather than being dropped

### Spec content is untrusted input and must never reach an attribute through string markup

Spec files, workflow definitions, filenames, and fence languages are all authored outside this codebase, and fenced regions in particular MUST render as displayed content that is never live in the page — highlighting and diagram rendering are applied after the content is safely in the DOM. The shared escaping helper is safe **only for element content** — it neutralises angle brackets and ampersands but not attribute quotes — so any markup that carries such a value into an attribute MUST be built with DOM APIs (create element, set property, set text) rather than assembled as a string. Treating the helper as a general-purpose sanitiser is the recurring way injection gets reintroduced here. Link destinations and other URL-shaped values additionally require an allow-list of safe schemes, since escaping alone does not make a destination safe to navigate to.

#### Scenario: user content is placed inside an element
- **WHEN** a value is rendered as visible text
- **THEN** the shared escaping helper is sufficient

#### Scenario: user content becomes an attribute value
- **WHEN** a value must land in an attribute — a label, a title, an image source, a link destination, a data value
- **THEN** the element is constructed programmatically and the value assigned as an attribute
- **AND** no string-concatenated markup carrying that value is assigned to a container's inner HTML

#### Scenario: a link destination is rendered
- **WHEN** markdown supplies an inline link
- **THEN** only destinations with an allowed scheme produce a navigable link; anything else renders as inert text

#### Scenario: a fence contains markup
- **WHEN** a spec includes HTML or script text inside a code fence
- **THEN** it is visible as code and is not live in the page

#### Scenario: a fence declares an unusual language
- **WHEN** the language token is arbitrary text
- **THEN** it is treated as an opaque label and cannot alter the surrounding element's structure

### Progress indicators are derived from the document, not stored alongside it

Completion state shown against phases or steps MUST be computed from the document's own contents on each render rather than tracked as separate state. One fact with two derivations will disagree, and the disagreement surfaces as a header claiming a phase is finished while the items beneath it are not. [inferred]

Known gap: the step-progress surface still encodes a fixed phase set that predates the configurable pipeline, so it cannot represent a workflow of a different shape. Aligning it is outstanding work, tied to the same change that makes the document panel's phase stepper follow the spec's recorded workflow.

#### Scenario: an item is checked off
- **WHEN** the underlying document changes
- **THEN** the phase's progress and completion indicator follow from a fresh reading of it

#### Scenario: a phase contains no trackable items
- **WHEN** there is nothing to count
- **THEN** it is not reported as complete merely because nothing is outstanding

