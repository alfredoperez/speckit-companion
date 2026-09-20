# Operating a panel — Living Spec

## Purpose

The controls a person clicks, tabs to and waits on are shared across every panel, and so is the floor those panels owe someone who navigates by keyboard, reads by screen reader, or has asked the system for less motion. Written once here, it holds everywhere; written per panel, the newest panel is always the one that forgot.

## Requirements

### Anything reachable by keyboard shows where the focus is
<!-- touches: apps/vscode/webview/styles/** -->

Every control a person can tab to SHALL draw a visible ring when focused by keyboard, offset far enough from the control to stay visible against its own background. Focus arriving by pointer SHALL NOT draw it.

#### Scenario: the person tabs through a panel
- **WHEN** focus moves from one control to the next by keyboard
- **THEN** the control now holding focus is visibly ringed, and it is the only one

### Reduced motion leaves a still that says the same thing
<!-- touches: apps/vscode/webview/styles/** -->

When the system asks for reduced motion, panels SHALL stop animating. Where an animation was the only thing carrying a meaning, such as marking which item the person was just sent to, the still state SHALL keep that meaning instead of leaving nothing behind.

#### Scenario: a jump highlights the item it landed on
- **WHEN** a panel would normally flash the item it scrolled to, and reduced motion is on
- **THEN** the item is marked without animating, so the person can still tell which one it is

### Marks that carry no meaning are hidden from assistive technology
<!-- touches: apps/vscode/webview/src/shared/**, apps/vscode/webview/styles/** -->

Icons, glyphs, spinners, dots, connectors and counters that only repeat or decorate what the neighbouring text already says SHALL be hidden from assistive technology. Anything a glyph alone conveys SHALL also exist as text.

#### Scenario: a control pairs an icon with its label
- **WHEN** a screen reader reads a control that shows an icon beside a written label
- **THEN** it reads the label once, and does not announce the icon

### Hidden means hidden, and hidden from sight is not hidden from a reader
<!-- touches: apps/vscode/webview/src/shared/**, apps/vscode/webview/styles/** -->

Something hidden SHALL be gone from the layout entirely, leaving no padding, border or empty band behind. Text written only for a screen reader SHALL be removed from sight while staying in the reading order, and these two SHALL NOT be confused for each other.

#### Scenario: a section is turned off
- **WHEN** a panel hides a section that had its own spacing and background
- **THEN** nothing of it remains on screen

#### Scenario: a name is clipped to fit
- **WHEN** a long name is truncated on screen
- **THEN** the whole name is still available to a screen reader

### Something that changes on its own is announced
<!-- touches: apps/vscode/webview/src/shared/** -->

A message that appears without the person acting, such as a result, a warning, an empty state or a transient confirmation, SHALL be announced to assistive technology politely rather than appearing only visually.

#### Scenario: an action reports its result
- **WHEN** a panel shows a short confirmation after a background action finishes
- **THEN** a screen reader announces it without the person having to go looking

### A control that is working says so and cannot be pressed again
<!-- touches: apps/vscode/webview/src/shared/** -->

A control waiting on something SHALL show that it is busy, SHALL be announced as busy, and SHALL refuse further presses until it is done.

#### Scenario: the person presses a control twice
- **WHEN** a control is pressed while it is still working on the previous press
- **THEN** nothing further is started

### A reversible action offers a window to undo it before it lands
<!-- touches: apps/vscode/webview/src/shared/** -->

An action offered with an undo SHALL show the time remaining, SHALL take effect exactly once when the time runs out, and SHALL be cancellable by pressing Undo or, where the panel has not claimed the key for something else, by pressing Escape.

#### Scenario: the person changes their mind
- **WHEN** Undo is chosen before the countdown finishes
- **THEN** the action never happens, and the countdown stops

#### Scenario: the panel already uses Escape
- **WHEN** Escape closes something the person has open, such as an inline editor
- **THEN** Escape closes that and does not undo the pending action

## Uncovered

- Escaping text a person wrote before it reaches a panel is deferred to `webview-safety`.
- How a control gets its look and which panel may roll its own is a build rule, not behaviour, and no rules file was written for this area.
