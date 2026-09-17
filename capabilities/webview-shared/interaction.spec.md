# Webview Shared Interaction — Living Spec

> [DRAFT] Surface-first draft from existing code. Every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

The interaction primitives every webview shares: the typed channel to the extension, the guards on destructive and automatic actions, and the teardown rules for transient overlays.

## Requirements

### Webviews talk to the extension through one typed channel
<!-- touches: webview/src/shared/hooks/useDispatch.ts -->

Consumers MUST send extension-bound messages through the shared dispatcher, never through the host bridge directly. One funnel keeps message shapes type-checked and gives tests a single seam to stub.

#### Scenario: a component needs to trigger extension work
- **WHEN** it must notify the extension
- **THEN** it dispatches a typed message through the shared channel
- **AND** the host bridge handle does not appear inline in the component

The shared dispatcher SHALL be generic over the protocol it sends, defaulting to the spec viewer's. A second webview must not have to widen the spec viewer's message union to adopt it.

#### Scenario: a second webview adopts the shared dispatcher
- **WHEN** it sends messages from its own protocol
- **THEN** they type-check against that protocol
- **AND** the spec viewer's message union is unchanged

### Destructive and automatic actions are reversible before they commit
<!-- touches: webview/src/shared/hooks/useInlineConfirm.ts, webview/src/shared/components/UndoToast.tsx -->

Any action a user cannot undo through ordinary editing MUST be guarded, either by a second confirmation within a short window or by a visible countdown the user can cancel. Both patterns MUST fire their effect at most once. Both MUST release their timers when the surface goes away.

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

Popovers, backdrops, and inline editors MUST replace any predecessor rather than stack. They MUST be dismissible by keyboard as well as pointer. They MUST restore whatever they displaced when they close, including on cancel.

#### Scenario: a second overlay is opened
- **WHEN** one is already open
- **THEN** the existing overlay and its backdrop are torn down first

#### Scenario: an edit is abandoned
- **WHEN** the user dismisses by keyboard, clicks the backdrop, or moves focus away
- **THEN** the overlay is removed and the original content is visible again unchanged

## Uncovered

_None. Every file in the area was read._
