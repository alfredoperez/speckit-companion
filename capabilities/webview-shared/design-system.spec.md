# Webview Shared Design System — Living Spec

> [DRAFT] Surface-first draft from existing code. Every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

The visual and accessibility floor every webview stands on: readable text meets contrast, hidden content stays in the accessibility tree, and new surfaces compose shared primitives.

## Requirements

### Readable content meets contrast; low-contrast tokens are for metadata only

Anything a user is expected to read MUST use the body or primary text tokens. The secondary and muted tokens fall below WCAG AA on dark themes, so they are reserved for chrome such as timestamps, counts, and labels. A theme-derived or composited token's contrast MUST be documented as a ratio, not as an effective colour.

#### Scenario: a card or panel shows explanatory prose
- **WHEN** the text carries meaning the user must read to act
- **THEN** it uses a readable text token even if it is visually secondary

#### Scenario: a semi-transparent token is introduced
- **WHEN** a token is defined by blending toward transparency
- **THEN** it is documented by its contrast ratio against the surfaces it is used on

### Accessible names and states survive the way they are hidden

Anything referenced by an accessibility relationship MUST stay in the accessibility tree, hidden by clipping rather than removed. Busy state MUST sit on the content region that becomes unavailable, not on the loading overlay. Live announcements MUST cover changes that are otherwise visual only. Decorative marks MUST be hidden from assistive technology.

#### Scenario: a control is described by adjacent text
- **WHEN** that description is not meant to be visible
- **THEN** it uses a visually-hidden treatment so it is still announced

#### Scenario: a region becomes unavailable while work runs
- **WHEN** an operation blocks interaction
- **THEN** the content region carries the busy state for its whole duration

### Consumers compose shared primitives instead of re-implementing them
<!-- touches: webview/src/shared/components/** -->

New interactive surfaces MUST use an existing primitive (pill, container, empty state, button, input, transient message) before hand-rolling markup. A new primitive MUST arrive with a story exercising its variants. Bespoke markup routed through a primitive without adopting its styling is a staging step, not the end state.

#### Scenario: a webview needs a new status indicator
- **WHEN** the shape already exists as a primitive
- **THEN** it composes that primitive rather than styling a fresh element

#### Scenario: a primitive gains a variant
- **WHEN** a new visual or semantic variant is added
- **THEN** its story is extended in the same change

## Uncovered

_None. Every file in the area was read._
