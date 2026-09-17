# Webview Shared Rendering — Living Spec

> [DRAFT] Surface-first draft from existing code. Every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

The contracts a webview honours when it renders a spec file: every control maps to a source line, one classifier decides what a line allows, and untrusted content never becomes live markup.

## Requirements

> A consuming webview must satisfy the requirements below. Their implementations live in the viewer, not in this shared area.

### Rendered documents stay addressable back to their source lines

Rendering MUST preserve the source line number behind each interactive element, and consumers MUST act on that number rather than on the rendered DOM. The DOM is a lossy projection of the file, so edits derived from it eventually target the wrong line.

#### Scenario: a line is edited in place
- **WHEN** the user commits an inline edit
- **THEN** the request carries the source line and the new plain text
- **AND** the extension, not the webview, rewrites the file

#### Scenario: content the user cannot act on
- **WHEN** a region is not individually editable, such as a fenced block, a rule, or a top-level title
- **THEN** it renders without per-line controls

### One classifier decides what each line is and what may be done to it

Whether a line can be deleted or refined MUST come from a single classification pass. The renderer and every consumer offering those affordances MUST read the same answer.

#### Scenario: a structural heading is rendered
- **WHEN** the line defines document or section structure
- **THEN** no delete affordance is offered, because deleting it would orphan everything beneath

#### Scenario: an unrecognised line shape appears
- **WHEN** content matches no known markdown shape
- **THEN** it still renders as readable prose with the affordances its classification grants

### Spec content is untrusted input and must never reach an attribute through string markup

Spec files, workflow definitions, filenames, and fence languages are untrusted, and fenced regions MUST render as displayed content that is never live in the page, with highlighting and diagrams applied after the content is safely in the DOM. The shared escaping helper does not escape attribute quotes, so any such value that lands in an attribute MUST be set through DOM APIs rather than string markup. Link destinations and other URL-shaped values additionally require an allow-list of safe schemes.

#### Scenario: user content is placed inside an element
- **WHEN** a value is rendered as visible text
- **THEN** the shared escaping helper is sufficient

#### Scenario: user content becomes an attribute value
- **WHEN** a value must land in an attribute, such as a label, title, image source, link destination, or data value
- **THEN** the element is built programmatically and the value assigned as an attribute
- **AND** no string-concatenated markup carrying that value is assigned to a container's inner HTML

#### Scenario: a link destination is rendered
- **WHEN** markdown supplies an inline link
- **THEN** only destinations with an allowed scheme produce a navigable link, and anything else renders as inert text

#### Scenario: a fence contains markup
- **WHEN** a spec includes HTML or script text inside a code fence
- **THEN** it is visible as code and is not live in the page

#### Scenario: a fence declares an unusual language
- **WHEN** the language token is arbitrary text
- **THEN** it is treated as an opaque label and cannot alter the surrounding element's structure

### Progress indicators are derived from the document, not stored alongside it

Completion state shown against phases or steps MUST be computed from the document's contents on each render, not tracked as separate state. [inferred]

Known gap: the step-progress surface still encodes a fixed phase set, so it cannot represent a workflow of a different shape. Fixing it is tied to making the document panel's phase stepper follow the spec's recorded workflow.

#### Scenario: an item is checked off
- **WHEN** the underlying document changes
- **THEN** the phase's progress and completion indicator follow from a fresh reading of it

#### Scenario: a phase contains no trackable items
- **WHEN** there is nothing to count
- **THEN** it is not reported as complete

## Uncovered

_None. Every file in the area was read._
