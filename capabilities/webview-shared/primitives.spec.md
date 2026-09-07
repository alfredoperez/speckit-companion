# Primitives — Living Spec

> Adopted from existing code on 2026-07-19. Requirements describe observed behavior and have not been individually verified against tests.

## Purpose

The reusable Preact components every webview composes from, and the contrast and accessibility contracts they carry so each consumer does not get them subtly wrong on its own.

## Requirements

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

## Uncovered

_None — every file in the area was read._
