# Webview Shared — Living Spec

> [DRAFT] Surface-first draft from existing code — every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

The common foundation every SpecKit Companion webview is built on: it turns spec markdown into an interactive, line-addressable document, supplies the reusable interaction primitives, and carries the correctness contracts — escaping, contrast, accessibility, cleanup — that each consuming webview would otherwise get subtly wrong on its own. Without it, every webview reinvents markdown rendering and its own escaping, and the invariants that keep untrusted spec content from injecting into the sandbox would hold in one place and fail in the next.

## Requirements

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

### Webviews talk to the extension through one typed channel

Consumers MUST send extension-bound messages through the shared dispatcher rather than reaching for the host bridge directly. A single funnel is what makes message shapes type-checked, lets tests stub one seam instead of every call site, and leaves room to add cross-cutting behaviour (logging, de-duplication, rate limiting) without touching consumers.

#### Scenario: a component needs to trigger extension work
- **WHEN** it must notify the extension
- **THEN** it dispatches a typed message through the shared channel
- **AND** the host bridge handle does not appear inline in the component

### Destructive and automatic actions are reversible before they commit

Any action a user cannot undo through ordinary editing MUST be guarded — either by requiring a second deliberate confirmation within a short window, or by deferring the effect behind a visible countdown the user can cancel. Both patterns MUST fire their effect at most once and MUST release their timers when the surface goes away, so a dismissed or unmounted affordance can never act later.

#### Scenario: the confirmation window lapses
- **WHEN** a user arms a destructive action and then does nothing
- **THEN** the action silently disarms without firing

#### Scenario: the user reverses a deferred action
- **WHEN** they cancel during the countdown, by button or by keyboard dismissal
- **THEN** the deferred effect never runs and no completion is reported

#### Scenario: the surface disappears mid-window
- **WHEN** the component unmounts while a timer is pending
- **THEN** the timer is cleared and nothing fires afterwards

### Transient overlays are singletons with a complete teardown

Popovers, backdrops, and inline editors MUST replace any predecessor rather than stacking, MUST be dismissible by keyboard as well as by pointer, and MUST restore whatever they displaced when they close — including on the cancel path. An overlay that leaves the original content hidden turns a cancelled edit into apparent data loss.

#### Scenario: a second overlay is opened
- **WHEN** one is already open
- **THEN** the existing overlay and its backdrop are torn down first

#### Scenario: an edit is abandoned
- **WHEN** the user dismisses by keyboard, clicks the backdrop, or moves focus away
- **THEN** the overlay is removed and the original rendered content is visible again unchanged

### Readable content meets contrast; low-contrast tokens are for metadata only

Anything a user is expected to read MUST use the body or primary text tokens. The secondary and muted tokens inherit VS Code's deliberately de-emphasised colours, which fall below WCAG AA on dark themes, so they are reserved for true chrome — timestamps, counts, labels beside a value. Because these tokens are theme-derived and composited, their contrast MUST be documented as a ratio; naming an "effective" colour is a cross-theme guarantee the tokens cannot make.

#### Scenario: a card or panel shows explanatory prose
- **WHEN** the text carries meaning the user must read to act
- **THEN** it uses a readable text token even if it is visually secondary in the layout

#### Scenario: a semi-transparent token is introduced
- **WHEN** a token is defined by blending toward transparency
- **THEN** it is documented by its contrast ratio against the surfaces it is used on

### Accessible names and states survive the way they are hidden

Anything referenced by an accessibility relationship MUST remain in the accessibility tree — visually hidden by clipping, never by the mechanisms that remove a node from it. Busy state MUST be placed on the content region that becomes unavailable, not on the loading overlay that appears over it, and live announcements MUST cover changes that are otherwise visual only. Decorative marks MUST be hidden from assistive technology so they are not read as content.

#### Scenario: a control is described by adjacent text
- **WHEN** that description is not meant to be visible
- **THEN** it is hidden by a visually-hidden treatment so the description is still announced

#### Scenario: a region becomes unavailable while work runs
- **WHEN** an operation blocks interaction
- **THEN** the content region carries the busy state for its whole duration

### Consumers compose shared primitives instead of re-implementing them

New interactive surfaces MUST reach for an existing primitive — pill, container, empty state, button, input, transient message — before hand-rolling markup, and a new primitive MUST arrive with a story exercising its variants. This is what keeps one visual pass able to change every consumer at once; each bespoke re-implementation is a place a later design change will silently miss. Where existing bespoke markup has been routed through a primitive without adopting its styling, that is a deliberate staging step, not the end state.

#### Scenario: a webview needs a new status indicator
- **WHEN** the shape already exists as a primitive
- **THEN** it composes that primitive rather than styling a fresh element

#### Scenario: a primitive gains a variant
- **WHEN** a new visual or semantic variant is added
- **THEN** its story is extended in the same change so the variant has a visible baseline

### Progress indicators are derived from the document, not stored alongside it

Completion state shown against phases or steps MUST be computed from the document's own contents on each render rather than tracked as separate state. One fact with two derivations will disagree, and the disagreement surfaces as a header claiming a phase is finished while the items beneath it are not. [inferred]

Known gap: the step-progress surface still encodes a fixed phase set that predates the configurable pipeline, so it cannot represent a workflow of a different shape. Aligning it is outstanding work, tied to the same change that makes the document panel's phase stepper follow the spec's recorded workflow.

#### Scenario: an item is checked off
- **WHEN** the underlying document changes
- **THEN** the phase's progress and completion indicator follow from a fresh reading of it

#### Scenario: a phase contains no trackable items
- **WHEN** there is nothing to count
- **THEN** it is not reported as complete merely because nothing is outstanding

## Uncovered

_None — every file in the area was read._
