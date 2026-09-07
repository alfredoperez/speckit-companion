# Webview Shared Interaction — Living Spec

> [DRAFT] Surface-first draft from existing code — every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

The interaction primitives every webview shares: the typed channel to the extension, the guards around destructive and automatic actions, and the teardown rules for transient overlays. Without them each webview reinvents the message bridge and the undo window, and one of them eventually fires an action after its surface is gone.

## Requirements

### Webviews talk to the extension through one typed channel
<!-- touches: webview/src/shared/hooks/useDispatch.ts -->

Consumers MUST send extension-bound messages through the shared dispatcher rather than reaching for the host bridge directly. A single funnel is what makes message shapes type-checked, lets tests stub one seam instead of every call site, and leaves room to add cross-cutting behaviour (logging, de-duplication, rate limiting) without touching consumers.

#### Scenario: a component needs to trigger extension work
- **WHEN** it must notify the extension
- **THEN** it dispatches a typed message through the shared channel
- **AND** the host bridge handle does not appear inline in the component

The shared dispatcher SHALL be generic over the protocol it sends, defaulting to the spec viewer's. A dispatcher pinned to one webview's message union is not shareable: a second webview could only adopt it by widening the first one's union, which is how a shared primitive becomes a coupling.

#### Scenario: a second webview adopts the shared dispatcher
- **WHEN** it sends messages from its own protocol
- **THEN** they type-check against that protocol
- **AND** the spec viewer's message union is unchanged

### Destructive and automatic actions are reversible before they commit
<!-- touches: webview/src/shared/hooks/useInlineConfirm.ts, webview/src/shared/components/UndoToast.tsx -->

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

## Uncovered

_None — every file in the area was read._
