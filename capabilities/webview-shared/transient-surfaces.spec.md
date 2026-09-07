# Transient Surfaces — Living Spec

> Adopted from existing code on 2026-07-19. Requirements describe observed behavior and have not been individually verified against tests.

## Purpose

Affordances that appear briefly and must not act after they are gone: two-click confirmation, undo countdowns, toasts, popovers, and inline editors.

## Requirements

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

