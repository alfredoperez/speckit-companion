# Reading a panel — Living Spec

## Purpose

Every screen the extension draws sits inside the editor the person already chose, and has to stay legible in whichever colour theme that is. Without one shared answer each panel picks its own colours, and the panel that picks badly ships text nobody can read.

## Requirements

### Panels take their colours from the editor's own theme
<!-- touches: apps/vscode/webview/styles/** -->

Every colour a panel paints SHALL come from the editor's active theme rather than a fixed palette, so switching theme restyles every panel without the panels knowing. Light, dark and high contrast each get their own answer where the derived colour would otherwise fail.

#### Scenario: the person switches to a light theme
- **WHEN** the editor theme changes from dark to light while a panel is open
- **THEN** the panel's backgrounds, text and borders follow it, and nothing is left painted for the old theme

#### Scenario: the person uses the high contrast theme
- **WHEN** a panel renders under high contrast
- **THEN** nothing is dimmed or softened, because high contrast asks for the strongest separation the theme can give

### Content a person is meant to read is never dimmed
<!-- touches: apps/vscode/webview/styles/** -->

Prose, headings, labels and values a person reads SHALL be painted at full strength. The dimmed tones exist for metadata that surrounds the content, such as timestamps, counts and secondary hints, and SHALL NOT carry anything the person has to read to understand the screen.

#### Scenario: a heading is styled as subordinate
- **WHEN** a sub-heading needs to read as lower in the hierarchy than the one above it
- **THEN** its size and weight carry the hierarchy, and its colour stays readable

### Text on a coloured fill uses the ink that belongs to that fill
<!-- touches: apps/vscode/webview/styles/** -->

A word placed on top of a coloured surface SHALL take the ink colour paired with that surface, never a plain white or black. A colour used to mark something, such as the review hue on a rule or a tint, SHALL NOT be used for the words themselves unless it has a readable ink variant for the current theme.

#### Scenario: a button is filled with the accent colour
- **WHEN** a control is painted with the action colour
- **THEN** its label uses the ink paired with that fill, so it stays readable whichever theme supplies the fill

### Status is never colour alone
<!-- touches: apps/vscode/webview/src/shared/**, apps/vscode/webview/styles/** -->

Wherever a panel shows a state, such as passing, warning, stale, running or complete, the state SHALL also be carried by a word or a mark, so someone who cannot tell the colours apart reads the same thing.

#### Scenario: a row reports that something is untested
- **WHEN** a row's state is shown with a coloured dot
- **THEN** the row also names the state in words beside the dot

## Uncovered

- Whether the derived dimmed tones clear the contrast standard in every theme a person may install is asserted in the stylesheet's own notes, not measured anywhere.
