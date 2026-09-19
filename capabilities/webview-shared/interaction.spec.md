# Webview Shared Interaction — Living Spec

## Purpose

The guards on destructive and deferred actions, and the teardown rules for inline editors, that every webview shares.

## Requirements

### Undo during the countdown cancels the deferred action
<!-- touches: webview/src/shared/components/UndoToast.tsx -->

Escape also undoes, except where the page already binds Escape, so cancelling an inline edit cannot undo a write.

#### Scenario: the user clicks Undo
- **WHEN** they click Undo or press Escape before the countdown ends
- **THEN** the deferred effect never runs

#### Scenario: the countdown ends
- **WHEN** nobody undoes
- **THEN** the deferred effect runs exactly once

### A guarded action never fires after its surface unmounts
<!-- touches: webview/src/shared/components/UndoToast.tsx -->

#### Scenario: the surface disappears mid-window
- **WHEN** the component unmounts while a confirmation or countdown is pending
- **THEN** its timer is cleared and nothing fires afterwards

### Transient overlays are singletons with a complete teardown

Opening an inline editor closes the one already open, so two never stack.

#### Scenario: a second editor is opened
- **WHEN** an inline editor is open and the user opens another
- **THEN** the first is removed before the second appears

### An abandoned inline edit leaves the line as it was

#### Scenario: an edit is abandoned
- **WHEN** the user presses Escape or moves focus away from an inline edit
- **THEN** the input is removed, the original line content shows again, and no edit is sent
