# Webview Shared Design System — Living Spec

## Purpose

The visual and accessibility floor every webview stands on: readable text meets contrast, hidden text stays announced, and new surfaces compose the shared primitives.

## Requirements

### Readable content meets contrast; low-contrast tokens are for metadata only
<!-- touches: apps/vscode/webview/src/shared/components/** -->

Text a user must read to act uses the body or primary text token. The secondary and muted tokens fall below WCAG AA on dark themes, so they are for chrome such as timestamps, counts and labels.

#### Scenario: a card shows explanatory prose
- **WHEN** a card renders a sentence the user must read to act
- **THEN** it uses the body or primary text token, even when it is visually secondary

### Accessible names and states survive the way they are hidden
<!-- touches: apps/vscode/webview/src/shared/components/** -->

Text referenced by an accessibility relationship is hidden by clipping, not removed, so assistive technology still announces it.

#### Scenario: a control is described by text that is not visible
- **WHEN** a screen reader focuses the control
- **THEN** it announces the hidden description

### Busy state sits on the region that becomes unavailable
<!-- touches: apps/vscode/webview/src/shared/components/** -->

While work blocks interaction, the busy state is set on the content region, not on the loading overlay.

#### Scenario: a form is submitting
- **WHEN** submission is in flight
- **THEN** the form's region reports busy until the submission settles

### Consumers compose shared primitives instead of re-implementing them
<!-- touches: apps/vscode/webview/src/shared/components/** -->

A new surface uses an existing primitive (badge, card, empty state, button, input, toast, tooltip, undo toast) before hand-rolling markup for the same shape.

#### Scenario: a webview needs a status indicator
- **WHEN** the badge primitive already has that shape
- **THEN** the surface renders the badge rather than styling a fresh element

### Every shared primitive has a story covering its variants
<!-- touches: apps/vscode/webview/src/shared/components/** -->

#### Scenario: a primitive gains a variant
- **WHEN** a new visual or semantic variant is added
- **THEN** the primitive's story shows it in the same change
